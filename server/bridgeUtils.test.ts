import { describe, expect, it } from "vitest";
import { createPairingExpiry, hashPairingPin, isValidPin, normalizePin } from "./bridgeUtils";

describe("pairing PIN utilities", () => {
  it("normalizes pasted PIN values and rejects invalid values", () => {
    expect(normalizePin(" 12-34 56 ")).toBe("123456");
    expect(isValidPin("123456")).toBe(true);
    expect(isValidPin("12345")).toBe(false);
    expect(isValidPin("ABC123")).toBe(false);
  });

  it("hashes a PIN deterministically without exposing its source", () => {
    expect(hashPairingPin("123456")).toBe(hashPairingPin("123456"));
    expect(hashPairingPin("123456")).not.toContain("123456");
  });

  it("creates a future pairing expiry", () => {
    expect(createPairingExpiry().getTime()).toBeGreaterThan(Date.now());
  });
});
