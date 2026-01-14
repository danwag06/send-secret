import crypto from "node:crypto";

/**
 * Generate a random URL-safe ID (128-bit entropy)
 */
export function generateId() {
  return crypto.randomBytes(16).toString("base64url");
}

/**
 * Format bytes into human-readable string
 */
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
