import { describe, expect, it } from "vitest";
import { mergeBinaryChunks } from "./useBridgeConnection";

describe("binary file transfer assembly", () => {
  it("merges ArrayBufferView-compatible chunks without changing byte order", () => {
    const first = new Uint8Array([137, 80, 78, 71]);
    const second = new Uint8Array([13, 10, 26, 10]);
    const result = mergeBinaryChunks([first, second], 8);

    expect(Array.from(result)).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });

  it("rejects incomplete and oversized payloads instead of creating a corrupt Blob", () => {
    expect(() => mergeBinaryChunks([new Uint8Array([1, 2])], 3)).toThrow("incomplete");
    expect(() => mergeBinaryChunks([new Uint8Array([1, 2, 3, 4])], 3)).toThrow("more binary");
  });
});
