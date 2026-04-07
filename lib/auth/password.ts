import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, savedHash] = storedHash.split(":");

  if (!salt || !savedHash) {
    return false;
  }

  const derived = scryptSync(password, salt, KEY_LENGTH);
  const saved = Buffer.from(savedHash, "hex");

  if (derived.length !== saved.length) {
    return false;
  }

  return timingSafeEqual(derived, saved);
}
