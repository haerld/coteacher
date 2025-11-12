import CryptoJS from "crypto-js";

const CRYPTO_KEY = process.env.NEXT_PUBLIC_CRYPTO_KEY || "default_secret_key";

// Base64 to URL-safe
function toUrlSafe(base64: string) {
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// URL-safe to Base64
function fromUrlSafe(urlSafe: string) {
  return urlSafe.replace(/-/g, "+").replace(/_/g, "/");
}

export function encrypt(text: string) {
  const encrypted = CryptoJS.AES.encrypt(text, CRYPTO_KEY).toString();
  return toUrlSafe(encrypted);
}

export function decrypt(urlSafeCipherText: string) {
  const base64CipherText = fromUrlSafe(urlSafeCipherText);
  const bytes = CryptoJS.AES.decrypt(base64CipherText, CRYPTO_KEY);
  const decrypted = bytes.toString(CryptoJS.enc.Utf8);
  if (!decrypted) throw new Error("Invalid or corrupted ciphertext");
  return decrypted;
}
