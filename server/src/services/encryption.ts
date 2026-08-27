import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// At-rest secret encryption (aes-256-gcm) for sensitive config values such as
// the Synology WebDAV password.
//
// The key is read from the DB_ENCRYPTION_KEY environment variable. It accepts
// either a 64-char hex string (32 bytes, recommended) or an arbitrary
// passphrase (derived to 32 bytes via scrypt).
// ---------------------------------------------------------------------------

const KEY_ENV = "DB_ENCRYPTION_KEY";
const SCRYPT_SALT = "stillworks-legalos-nas-encryption";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit nonce, recommended for GCM
const KEY_LENGTH = 32;

function getEncryptionKey(): Buffer {
  const raw = process.env[KEY_ENV];
  if (!raw) {
    throw new Error(
      `${KEY_ENV} is not configured. Generate a key with:\n` +
        `  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"\n` +
        `and add it to server/.env`,
    );
  }

  if (/^[a-fA-F0-9]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  // Accept an arbitrary passphrase by deriving a 32-byte key.
  return crypto.scryptSync(raw, SCRYPT_SALT, KEY_LENGTH);
}

/** Encrypts a plaintext secret. Returns "iv:authTag:ciphertext" (base64). */
export function encryptSecret(plaintext: string): string {
  if (!plaintext) return "";

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv, tag, encrypted].map((b) => b.toString("base64")).join(":");
}

/** Decrypts a secret previously produced by `encryptSecret`. */
export function decryptSecret(ciphertext: string): string {
  if (!ciphertext) return "";

  const key = getEncryptionKey();
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted secret format");
  }

  const [ivB64, tagB64, dataB64] = parts as [string, string, string];
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
