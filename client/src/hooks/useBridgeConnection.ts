import { useCallback, useEffect, useRef, useState } from "react";
import Peer, { type DataConnection } from "peerjs";

export type BridgeStatus = "idle" | "waiting" | "connecting" | "connected" | "error" | "expired";
export type TransferStatus = "queued" | "sending" | "receiving" | "complete" | "failed";
export type TransferItem = { id: string; name: string; size: number; progress: number; status: TransferStatus; direction: "outgoing" | "incoming"; downloadUrl?: string };
export type BridgeText = { id: string; body: string; direction: "outgoing" | "incoming"; time: number };
type Role = "host" | "guest";
type Pairing = { sessionId: string; roleToken: string; pin: string; role: Role; expiresAt: number };
type IncomingFile = { id: string; name: string; size: number; mime: string; chunks: ArrayBuffer[]; received: number };

const CHUNK_SIZE = 16 * 1024;
const PAIRING_TTL_MS = 10 * 60 * 1000;

function createPin() { return Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0"); }
function bridgeId(pin: string) { return `pratix-bridge-${pin}`; }
function fileId() { return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : "The direct connection could not be started."; }

function awaitPeerOpen(peer: Peer) {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    peer.on("open", () => { if (!settled) { settled = true; resolve(); } });
    peer.on("error", error => { if (!settled) { settled = true; reject(error); } });
  });
}

export function useBridgeConnection() {
  const [status, setStatus] = useState<BridgeStatus>("idle");
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [texts, setTexts] = useState<BridgeText[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const peerRef = useRef<Peer | null>(null);
  const connectionRef = useRef<DataConnection | null>(null);
  const pairingRef = useRef<Pairing | null>(null);
  const expiryTimerRef = useRef<number | null>(null);
  const incomingFileRef = useRef<IncomingFile | null>(null);

  const updateTransfer = useCallback((id: string, updates: Partial<TransferItem>) => setTransfers(current => current.map(item => item.id === id ? { ...item, ...updates } : item)), []);

  const clearExpiry = useCallback(() => { if (expiryTimerRef.current) window.clearTimeout(expiryTimerRef.current); expiryTimerRef.current = null; }, []);
  const dispose = useCallback(() => {
    clearExpiry();
    connectionRef.current?.close();
    peerRef.current?.destroy();
    connectionRef.current = null;
    peerRef.current = null;
  }, [clearExpiry]);

  useEffect(() => () => dispose(), [dispose]);

  const finishIncomingFile = useCallback(() => {
    const incoming = incomingFileRef.current;
    if (!incoming) return;
    const url = URL.createObjectURL(new Blob(incoming.chunks, { type: incoming.mime || "application/octet-stream" }));
    updateTransfer(incoming.id, { progress: 100, status: "complete", downloadUrl: url });
    incomingFileRef.current = null;
  }, [updateTransfer]);

  const receiveChunk = useCallback((data: ArrayBuffer) => {
    const incoming = incomingFileRef.current;
    if (!incoming) return;
    incoming.chunks.push(data);
    incoming.received += data.byteLength;
    updateTransfer(incoming.id, { progress: Math.min(99, Math.round((incoming.received / incoming.size) * 100)), status: "receiving" });
  }, [updateTransfer]);

  const attachConnection = useCallback((connection: DataConnection) => {
    connectionRef.current = connection;
    connection.on("open", () => { setStatus("connected"); setError(null); });
    connection.on("close", () => { if (pairingRef.current) { setStatus("error"); setError("Connection closed. Create a new bridge to reconnect."); } });
    connection.on("error", cause => { setStatus("error"); setError(errorMessage(cause)); });
    connection.on("data", data => {
      if (typeof data === "string") {
        try {
          const message = JSON.parse(data) as { type?: string; id?: string; body?: string; name?: string; size?: number; mime?: string; time?: number };
          const body = message.body;
          if (message.type === "text" && body) setTexts(current => [...current, { id: message.id ?? fileId(), body, direction: "incoming", time: message.time ?? Date.now() }]);
          if (message.type === "file-meta" && message.id && message.name && typeof message.size === "number") {
            incomingFileRef.current = { id: message.id, name: message.name, size: message.size, mime: message.mime ?? "", chunks: [], received: 0 };
            setTransfers(current => [...current, { id: message.id!, name: message.name!, size: message.size!, progress: 0, status: "receiving", direction: "incoming" }]);
          }
          if (message.type === "file-complete") finishIncomingFile();
        } catch { /* Ignore malformed user data. */ }
        return;
      }
      if (data instanceof ArrayBuffer) receiveChunk(data);
      else if (data instanceof Blob) void data.arrayBuffer().then(receiveChunk);
    });
  }, [finishIncomingFile, receiveChunk]);

  const configurePeer = useCallback((peer: Peer) => {
    peerRef.current = peer;
    peer.on("connection", attachConnection);
    peer.on("error", cause => {
      if (pairingRef.current) { setStatus("error"); setError(errorMessage(cause)); }
    });
  }, [attachConnection]);

  const startExpiry = useCallback((active: Pairing) => {
    clearExpiry();
    const remaining = Math.max(0, active.expiresAt - Date.now());
    expiryTimerRef.current = window.setTimeout(() => {
      if (connectionRef.current?.open) {
        peerRef.current?.disconnect();
      } else {
        setStatus("expired");
        setError("This PIN has expired. Create a new bridge to continue.");
        peerRef.current?.destroy();
      }
    }, remaining);
  }, [clearExpiry]);

  const createBridge = useCallback(async () => {
    dispose(); setError(null); setStatus("connecting"); setIsBusy(true);
    try {
      let created: { pin: string; peer: Peer } | null = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const pin = createPin();
        const peer = new Peer(bridgeId(pin));
        try {
          await awaitPeerOpen(peer);
          created = { pin, peer };
          break;
        } catch {
          peer.destroy();
        }
      }
      if (!created) throw new Error("Could not reserve a temporary PIN. Please try again.");
      const active: Pairing = { sessionId: created.peer.id, roleToken: "", pin: created.pin, role: "host", expiresAt: Date.now() + PAIRING_TTL_MS };
      pairingRef.current = active; setPairing(active); configurePeer(created.peer); startExpiry(active); setStatus("waiting");
    } catch (cause) { setStatus("error"); setError(errorMessage(cause)); }
    finally { setIsBusy(false); }
  }, [configurePeer, dispose, startExpiry]);

  const joinBridge = useCallback(async (pinInput: string) => {
    const pin = pinInput.replace(/\D/g, "").slice(0, 6);
    if (!/^\d{6}$/.test(pin)) { setError("Enter a six-digit PIN."); return; }
    dispose(); setError(null); setStatus("connecting"); setIsBusy(true);
    try {
      const peer = new Peer();
      await awaitPeerOpen(peer);
      const active: Pairing = { sessionId: peer.id, roleToken: "", pin, role: "guest", expiresAt: Date.now() + PAIRING_TTL_MS };
      pairingRef.current = active; setPairing(active); configurePeer(peer); startExpiry(active);
      const connection = peer.connect(bridgeId(pin), { reliable: true, serialization: "binary" });
      attachConnection(connection);
    } catch (cause) { setStatus("error"); setError(errorMessage(cause)); }
    finally { setIsBusy(false); }
  }, [attachConnection, configurePeer, dispose, startExpiry]);

  const sendText = useCallback((body: string) => {
    const connection = connectionRef.current;
    if (!connection?.open || !body.trim()) return false;
    const message = { type: "text", id: fileId(), body: body.trim(), time: Date.now() };
    connection.send(JSON.stringify(message));
    setTexts(current => [...current, { id: message.id, body: message.body, direction: "outgoing", time: message.time }]);
    return true;
  }, []);

  const waitForBuffer = useCallback(async (connection: DataConnection) => {
    while (connection.dataChannel.bufferedAmount > 256 * 1024) await new Promise(resolve => window.setTimeout(resolve, 40));
  }, []);

  const sendFiles = useCallback(async (files: File[]) => {
    const connection = connectionRef.current;
    if (!connection?.open) { setError("Connect a second device before sending files."); return; }
    for (const file of files) {
      const id = fileId();
      setTransfers(current => [...current, { id, name: file.name, size: file.size, progress: 0, status: "queued", direction: "outgoing" }]);
      try {
        updateTransfer(id, { status: "sending" });
        connection.send(JSON.stringify({ type: "file-meta", id, name: file.name, size: file.size, mime: file.type }));
        let sent = 0;
        for (let offset = 0; offset < file.size; offset += CHUNK_SIZE) {
          await waitForBuffer(connection);
          const chunk = await file.slice(offset, offset + CHUNK_SIZE).arrayBuffer();
          connection.send(chunk); sent += chunk.byteLength;
          if (offset === 0 || offset + CHUNK_SIZE >= file.size || offset % (CHUNK_SIZE * 8) === 0) updateTransfer(id, { progress: Math.round((sent / file.size) * 100) });
        }
        connection.send(JSON.stringify({ type: "file-complete", id }));
        updateTransfer(id, { progress: 100, status: "complete" });
      } catch { updateTransfer(id, { status: "failed" }); setError(`Could not send ${file.name}. Please retry with a fresh bridge.`); }
    }
  }, [updateTransfer, waitForBuffer]);

  const restart = useCallback(() => {
    dispose(); pairingRef.current = null; setPairing(null); setStatus("idle"); setError(null); setTransfers([]); setTexts([]);
  }, [dispose]);

  return { status, pairing, error, transfers, texts, createBridge, joinBridge, sendText, sendFiles, restart, isBusy };
}
