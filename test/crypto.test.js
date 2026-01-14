import { describe, it, expect } from "vitest";
import { encrypt, decrypt, generateKey } from "../src/crypto.js";

describe("crypto", () => {
  it("generates a 256-bit key as 64-char hex string", () => {
    const key = generateKey();
    expect(key).toHaveLength(64);
    expect(key).toMatch(/^[0-9a-f]+$/);
  });

  it("generates unique keys", () => {
    const keys = new Set();
    for (let i = 0; i < 100; i++) {
      keys.add(generateKey());
    }
    expect(keys.size).toBe(100);
  });

  it("encrypts and decrypts text", () => {
    const key = generateKey();
    const plaintext = Buffer.from("hello world");

    const encrypted = encrypt(plaintext, key);
    const decrypted = decrypt(encrypted, key);

    expect(decrypted.toString()).toBe("hello world");
  });

  it("encrypts and decrypts binary data", () => {
    const key = generateKey();
    const binary = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0x00]);

    const encrypted = encrypt(binary, key);
    const decrypted = decrypt(encrypted, key);

    expect(decrypted).toEqual(binary);
  });

  it("encrypts and decrypts empty data", () => {
    const key = generateKey();
    const empty = Buffer.from([]);

    const encrypted = encrypt(empty, key);
    const decrypted = decrypt(encrypted, key);

    expect(decrypted).toEqual(empty);
  });

  it("encrypts and decrypts large data", () => {
    const key = generateKey();
    const large = Buffer.alloc(1024 * 1024, "x"); // 1MB

    const encrypted = encrypt(large, key);
    const decrypted = decrypt(encrypted, key);

    expect(decrypted).toEqual(large);
  });

  it("produces different ciphertext for same plaintext (due to random IV)", () => {
    const key = generateKey();
    const plaintext = Buffer.from("same text");

    const encrypted1 = encrypt(plaintext, key);
    const encrypted2 = encrypt(plaintext, key);

    // Ciphertexts should differ due to different IVs
    expect(encrypted1.equals(encrypted2)).toBe(false);

    // But both should decrypt to the same plaintext
    expect(decrypt(encrypted1, key).toString()).toBe("same text");
    expect(decrypt(encrypted2, key).toString()).toBe("same text");
  });

  it("fails to decrypt with wrong key", () => {
    const key1 = generateKey();
    const key2 = generateKey();
    const plaintext = Buffer.from("secret");

    const encrypted = encrypt(plaintext, key1);

    expect(() => decrypt(encrypted, key2)).toThrow();
  });

  it("fails to decrypt tampered ciphertext", () => {
    const key = generateKey();
    const plaintext = Buffer.from("secret");

    const encrypted = encrypt(plaintext, key);
    // Tamper with ciphertext (after IV and auth tag)
    encrypted[30] ^= 0xff;

    expect(() => decrypt(encrypted, key)).toThrow();
  });

  it("fails to decrypt tampered auth tag", () => {
    const key = generateKey();
    const plaintext = Buffer.from("secret");

    const encrypted = encrypt(plaintext, key);
    // Tamper with auth tag
    encrypted[15] ^= 0xff;

    expect(() => decrypt(encrypted, key)).toThrow();
  });

  it("encrypted format is IV (12) + AuthTag (16) + Ciphertext", () => {
    const key = generateKey();
    const plaintext = Buffer.from("test");

    const encrypted = encrypt(plaintext, key);

    // Minimum size: 12 (IV) + 16 (AuthTag) + plaintext length
    expect(encrypted.length).toBeGreaterThanOrEqual(28 + plaintext.length);
  });
});
