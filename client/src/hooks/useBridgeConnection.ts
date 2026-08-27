import { useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";

export type BridgeStatus = "idle" | "waiting" | "connecting" | "connected" | "error" | "expired";
export type TransferStatus = "queued" | "sending" | "receiving" | "complete" | "failed";
export type TransferItem = { id: string; name: string; size: number; progress: number; status: TransferStatus; direction: "outgoing" | "incoming"; downloadUrl?: string };
export type BridgeText = { id: string; body: string; direction: "outgoing" | "incoming"; time: number };
type Role = "host" | "guest";
type Pairing = { sessionId: string; roleToken: string; pin: string; role: Role; expiresAt: number };
type WireDescription = { type: RTCSdpType; sdp: string };
type WireSignal =
  | { kind: "offer"; description: WireDescription }
  | { kind: "answer"; description: WireDescription }
  | { kind: "candidate"; candidate: Record<string, unknown> };
type IncomingFile = { id: string; name: string; size: number; mime: string; chunks: ArrayBuffer[]; received: number };

const CHUNK_SIZE = 16 * 1024;
const FALLBACK_ICE: RTCConfiguration = { iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }] };

function fileId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

export function useBridgeConnection() {
  const createMutation = trpc.bridge.create.useMutation();
  const joinMutation = trpc.bridge.join.useMutation();
  const relayMutation = trpc.bridge.relay.useMutation();
  const watchMutation = trpc.bridge.watch.useMutation();
  const iceQuery = trpc.bridge.iceConfig.useQuery();
  const closeMutation = trpc.bridge.close.useMutation();
  const [status, setStatus] = useState<BridgeStatus>("idle");
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [texts, setTexts] = useState<BridgeText[]>([]);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const pairingRef = useRef<Pairing | null>(null);
  const handledSignalsRef = useRef(new Set<number>());
  const queuedCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const incomingFileRef = useRef<IncomingFile | null>(null);
  const pollTimerRef = useRef<number | null>(null);

  const updateTransfer = useCallback((id: string, updates: Partial<TransferItem>) => {
    setTransfers(current => current.map(item => item.id === id ? { ...item, ...updates } : item));
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
    pollTimerRef.current = null;
  }, []);

  const disposePeer = useCallback(() => {
    channelRef.current?.close();
    pcRef.current?.close();
    channelRef.current = null;
    pcRef.current = null;
    queuedCandidatesRef.current = [];
  }, []);

  useEffect(() => () => { stopPolling(); disposePeer(); }, [disposePeer, stopPolling]);

  const publishSignal = useCallback(async (payload: WireSignal) => {
    const active = pairingRef.current;
    if (!active) return;
    await relayMutation.mutateAsync({ sessionId: active.sessionId, roleToken: active.roleToken, payload });
  }, [relayMutation]);

  const finishIncomingFile = useCallback(() => {
    const incoming = incomingFileRef.current;
    if (!incoming) return;
    const url = URL.createObjectURL(new Blob(incoming.chunks, { type: incoming.mime || "application/octet-stream" }));
    updateTransfer(incoming.id, { progress: 100, status: "complete", downloadUrl: url });
    incomingFileRef.current = null;
  }, [updateTransfer]);

  const attachChannel = useCallback((channel: RTCDataChannel) => {
    channelRef.current = channel;
    channel.binaryType = "arraybuffer";
    channel.onopen = () => { setStatus("connected"); setError(null); };
    channel.onclose = () => { if (pairingRef.current) setStatus(previous => previous === "connected" ? "error" : previous); };
    channel.onerror = () => { setStatus("error"); setError("The direct connection encountered an error. You can restart the pairing."); };
    channel.onmessage = event => {
      if (typeof event.data === "string") {
        try {
          const message = JSON.parse(event.data) as { type: string; id?: string; body?: string; name?: string; size?: number; mime?: string; time?: number };
          if (message.type === "text" && message.body) setTexts(current => [...current, { id: message.id ?? fileId(), body: message.body!, direction: "incoming", time: message.time ?? Date.now() }]);
          if (message.type === "file-meta" && message.id && message.name && typeof message.size === "number") {
            incomingFileRef.current = { id: message.id, name: message.name, size: message.size, mime: message.mime ?? "", chunks: [], received: 0 };
            setTransfers(current => [...current, { id: message.id!, name: message.name!, size: message.size!, progress: 0, status: "receiving", direction: "incoming" }]);
          }
          if (message.type === "file-complete") finishIncomingFile();
        } catch { /* Ignore malformed channel controls. */ }
        return;
      }
      const incoming = incomingFileRef.current;
      if (!incoming) return;
      const chunk = event.data as ArrayBuffer;
      incoming.chunks.push(chunk);
      incoming.received += chunk.byteLength;
      updateTransfer(incoming.id, { progress: Math.min(99, Math.round((incoming.received / incoming.size) * 100)), status: "receiving" });
    };
  }, [finishIncomingFile, updateTransfer]);

  const handleSignal = useCallback(async (wire: WireSignal) => {
    const active = pairingRef.current;
    const peer = pcRef.current;
    if (!active || !peer) return;
    if (wire.kind === "candidate") {
      if (peer.remoteDescription) await peer.addIceCandidate(new RTCIceCandidate(wire.candidate as RTCIceCandidateInit)).catch(() => undefined);
      else queuedCandidatesRef.current.push(wire.candidate as RTCIceCandidateInit);
      return;
    }
    if (wire.kind === "offer" && active.role === "guest") {
      await peer.setRemoteDescription(new RTCSessionDescription(wire.description));
      for (const candidate of queuedCandidatesRef.current.splice(0)) await peer.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => undefined);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await publishSignal({ kind: "answer", description: { type: "answer", sdp: answer.sdp ?? "" } });
      setStatus("connecting");
      return;
    }
    if (wire.kind === "answer" && active.role === "host") {
      await peer.setRemoteDescription(new RTCSessionDescription(wire.description));
      for (const candidate of queuedCandidatesRef.current.splice(0)) await peer.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => undefined);
      setStatus("connecting");
    }
  }, [publishSignal]);

  const pollSignals = useCallback(async () => {
    const active = pairingRef.current;
    if (!active) return;
    if (Date.now() > active.expiresAt) {
      stopPolling(); setStatus("expired"); setError("This PIN has expired. Create a new bridge to continue."); return;
    }
    try {
      const data = await watchMutation.mutateAsync({ sessionId: active.sessionId, roleToken: active.roleToken });
      for (const signal of data.signals) {
        if (handledSignalsRef.current.has(signal.id)) continue;
        handledSignalsRef.current.add(signal.id);
        await handleSignal(signal.payload as WireSignal);
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Pairing service unavailable.";
      setStatus(message.toLowerCase().includes("expired") ? "expired" : "error"); setError(message);
    }
  }, [handleSignal, stopPolling, watchMutation]);

  const startPolling = useCallback(() => {
    stopPolling(); void pollSignals(); pollTimerRef.current = window.setInterval(() => void pollSignals(), 850);
  }, [pollSignals, stopPolling]);

  const preparePeer = useCallback(async (active: Pairing) => {
    disposePeer();
    const peer = new RTCPeerConnection(iceQuery.data ?? FALLBACK_ICE);
    pcRef.current = peer;
    peer.onicecandidate = event => { if (event.candidate) void publishSignal({ kind: "candidate", candidate: event.candidate.toJSON() as Record<string, unknown> }); };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "connected") { setStatus("connected"); setError(null); }
      if (peer.connectionState === "failed" || peer.connectionState === "disconnected") { setStatus("error"); setError("Connection interrupted. Restart the bridge and try again."); }
    };
    peer.ondatachannel = event => attachChannel(event.channel);
    startPolling();
    if (active.role === "host") {
      const channel = peer.createDataChannel("pratix-bridge", { ordered: true });
      attachChannel(channel);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await publishSignal({ kind: "offer", description: { type: offer.type, sdp: offer.sdp ?? "" } });
      setStatus("waiting");
    } else setStatus("connecting");
  }, [attachChannel, disposePeer, iceQuery.data, publishSignal, startPolling]);

  const createBridge = useCallback(async () => {
    setError(null); setStatus("connecting");
    try {
      const result = await createMutation.mutateAsync();
      const active: Pairing = { ...result, role: "host" };
      pairingRef.current = active; setPairing(active); handledSignalsRef.current.clear(); await preparePeer(active);
    } catch (cause) { setStatus("error"); setError(cause instanceof Error ? cause.message : "Unable to create a bridge."); }
  }, [createMutation, preparePeer]);

  const joinBridge = useCallback(async (pin: string) => {
    setError(null); setStatus("connecting");
    try {
      const result = await joinMutation.mutateAsync({ pin });
      const active: Pairing = { ...result, role: "guest" };
      pairingRef.current = active; setPairing(active); handledSignalsRef.current.clear(); await preparePeer(active);
    } catch (cause) { setStatus("error"); setError(cause instanceof Error ? cause.message : "Unable to join this bridge."); }
  }, [joinMutation, preparePeer]);

  const sendText = useCallback((body: string) => {
    const channel = channelRef.current;
    if (!channel || channel.readyState !== "open" || !body.trim()) return false;
    const message = { type: "text", id: fileId(), body: body.trim(), time: Date.now() };
    channel.send(JSON.stringify(message));
    setTexts(current => [...current, { id: message.id, body: message.body, direction: "outgoing", time: message.time }]);
    return true;
  }, []);

  const waitForBuffer = useCallback(async (channel: RTCDataChannel) => {
    while (channel.bufferedAmount > 256 * 1024) await new Promise(resolve => window.setTimeout(resolve, 40));
  }, []);

  const sendFiles = useCallback(async (files: File[]) => {
    const channel = channelRef.current;
    if (!channel || channel.readyState !== "open") { setError("Connect a second device before sending files."); return; }
    for (const file of files) {
      const id = fileId();
      setTransfers(current => [...current, { id, name: file.name, size: file.size, progress: 0, status: "queued", direction: "outgoing" }]);
      try {
        updateTransfer(id, { status: "sending" });
        channel.send(JSON.stringify({ type: "file-meta", id, name: file.name, size: file.size, mime: file.type }));
        let sent = 0;
        for (let offset = 0; offset < file.size; offset += CHUNK_SIZE) {
          await waitForBuffer(channel);
          const chunk = await file.slice(offset, offset + CHUNK_SIZE).arrayBuffer();
          channel.send(chunk); sent += chunk.byteLength;
          if (offset === 0 || offset + CHUNK_SIZE >= file.size || offset % (CHUNK_SIZE * 8) === 0) updateTransfer(id, { progress: Math.round((sent / file.size) * 100) });
        }
        channel.send(JSON.stringify({ type: "file-complete", id })); updateTransfer(id, { progress: 100, status: "complete" });
      } catch { updateTransfer(id, { status: "failed" }); setError(`Could not send ${file.name}. Please retry with a fresh bridge.`); }
    }
  }, [updateTransfer, waitForBuffer]);

  const restart = useCallback(() => {
    const active = pairingRef.current;
    stopPolling(); disposePeer();
    if (active) void closeMutation.mutate({ sessionId: active.sessionId, roleToken: active.roleToken });
    pairingRef.current = null; setPairing(null); setStatus("idle"); setError(null); setTransfers([]); setTexts([]); handledSignalsRef.current.clear();
  }, [closeMutation, disposePeer, stopPolling]);

  return { status, pairing, error, transfers, texts, createBridge, joinBridge, sendText, sendFiles, restart, isBusy: createMutation.isPending || joinMutation.isPending };
}
