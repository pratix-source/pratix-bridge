import { describe, expect, it } from "vitest";
import { applyDecodedTransferPacket, applyFileAck, attachDataHandler, createDataHandler, decodeBridgePacket, mergeBinaryChunks, toOwnedArrayBuffer, type TransferItem } from "./useBridgeConnection";
import type { DataConnection } from "peerjs";

describe("binary file transfer assembly", () => {
  it("merges ArrayBufferView-compatible chunks without changing byte order", () => {
    const first = new Uint8Array([137, 80, 78, 71]);
    const second = new Uint8Array([13, 10, 26, 10]);
    const result = mergeBinaryChunks([first, second], 8);

    expect(Array.from(result)).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });

  it("routes an ArrayBufferView packet through the real decoder path", async () => {
    const source = new Uint8Array([9, 8, 7, 6]);
    const packet = await decodeBridgePacket(source.subarray(1, 3));
    expect(packet?.kind).toBe("binary");
    expect(packet?.kind === "binary" ? Array.from(new Uint8Array(packet.buffer)) : []).toEqual([8, 7]);
    expect(Array.from(new Uint8Array(toOwnedArrayBuffer(source.subarray(1, 3))))).toEqual([8, 7]);
  });

  it("rejects incomplete and oversized payloads instead of creating a corrupt Blob", () => {
    expect(() => mergeBinaryChunks([new Uint8Array([1, 2])], 3)).toThrow("incomplete");
    expect(() => mergeBinaryChunks([new Uint8Array([1, 2, 3, 4])], 3)).toThrow("more binary");
  });

  it("runs an ArrayBufferView through the attached DataConnection handler", async () => {
    let listener: ((data: unknown) => void) | undefined;
    const fakeConnection = { on: (event: string, callback: (data: unknown) => void) => { if (event === "data") listener = callback; return fakeConnection; } } as unknown as DataConnection;
    const received: ArrayBuffer[] = [];
    attachDataHandler(fakeConnection, createDataHandler({ onBinary: buffer => received.push(buffer), onMessage: () => undefined, onError: () => undefined }));
    listener?.(new Uint8Array([0, 4, 5, 0]).subarray(1, 3));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(received.map(buffer => Array.from(new Uint8Array(buffer)))).toEqual([[4, 5]]);
  });

  it("runs a file-ack string through the attached DataConnection handler", async () => {
    let listener: ((data: unknown) => void) | undefined;
    const fakeConnection = { on: (event: string, callback: (data: unknown) => void) => { if (event === "data") listener = callback; return fakeConnection; } } as unknown as DataConnection;
    const transfers: TransferItem[] = [{ id: "file-1", name: "photo.png", size: 4, progress: 99, status: "sending", direction: "outgoing" }];
    let updated = transfers;
    attachDataHandler(fakeConnection, createDataHandler({ onBinary: () => undefined, onError: () => undefined, onMessage: message => { updated = applyDecodedTransferPacket({ kind: "message", message }, updated); } }));
    listener?.(JSON.stringify({ type: "file-ack", id: "file-1" }));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(updated[0]).toMatchObject({ progress: 100, status: "complete" });
    expect(applyFileAck(transfers, "file-1")[0]).toMatchObject({ progress: 100, status: "complete" });
  });
});
