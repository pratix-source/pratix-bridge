import { createHash, randomInt } from "node:crypto";

export const PAIRING_TTL_MS = 10 * 60 * 1000;

export function normalizePin(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

export function isValidPin(value: string) {
  return /^\d{6}$/.test(value);
}

export function createPairingPin() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashPairingPin(pin: string) {
  return createHash("sha256").update(pin).digest("hex");
}

export function createPairingExpiry() {
  return new Date(Date.now() + PAIRING_TTL_MS);
}
