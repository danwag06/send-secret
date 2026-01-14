import crypto from "node:crypto";

/**
 * Generate a 256-bit random key as hex string
 */
export function generateKey() {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Encrypt plaintext using AES-256-GCM
 * @param {Buffer} plaintext - Data to encrypt
 * @param {string} keyHex - 256-bit key as hex string
 * @returns {Buffer} IV (12 bytes) + AuthTag (16 bytes) + Ciphertext
 */
export function encrypt(plaintext, keyHex) {
  const key = Buffer.from(keyHex, "hex");
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Return: IV (12 bytes) + AuthTag (16 bytes) + Ciphertext
  return Buffer.concat([iv, authTag, encrypted]);
}

/**
 * Decrypt ciphertext using AES-256-GCM
 * @param {Buffer} encryptedBuffer - IV + AuthTag + Ciphertext
 * @param {string} keyHex - 256-bit key as hex string
 * @returns {Buffer} Decrypted plaintext
 */
export function decrypt(encryptedBuffer, keyHex) {
  const key = Buffer.from(keyHex, "hex");

  const iv = encryptedBuffer.subarray(0, 12);
  const authTag = encryptedBuffer.subarray(12, 28);
  const ciphertext = encryptedBuffer.subarray(28);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
