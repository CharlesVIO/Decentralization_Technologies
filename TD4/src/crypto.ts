/// <reference lib="dom" />

import { webcrypto } from "crypto";
const subtle = webcrypto.subtle;

// #############
// ### Utils ###
// #############

// Convertit un ArrayBuffer en chaîne Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString("base64");
}

// Convertit une chaîne Base64 en ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  return Uint8Array.from(Buffer.from(base64, "base64")).buffer;
}

// ################
// ### RSA keys ###
// ################

type GenerateRsaKeyPair = {
  publicKey: webcrypto.CryptoKey;
  privateKey: webcrypto.CryptoKey;
};

export async function generateRsaKeyPair(): Promise<GenerateRsaKeyPair> {
  return await subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function exportPubKey(key: webcrypto.CryptoKey): Promise<string> {
  const spki = await subtle.exportKey("spki", key);
  return arrayBufferToBase64(spki);
}

export async function exportPrvKey(key: webcrypto.CryptoKey | null): Promise<string | null> {
  if (!key) return null;
  const pkcs8 = await subtle.exportKey("pkcs8", key);
  return arrayBufferToBase64(pkcs8);
}

export async function importPubKey(strKey: string): Promise<webcrypto.CryptoKey> {
  const spki = base64ToArrayBuffer(strKey);
  return await subtle.importKey(
    "spki",
    spki,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
}

export async function importPrvKey(strKey: string): Promise<webcrypto.CryptoKey> {
  const pkcs8 = base64ToArrayBuffer(strKey);
  return await subtle.importKey(
    "pkcs8",
    pkcs8,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"]
  );
}

export async function rsaEncrypt(b64Data: string, strPublicKey: string): Promise<string> {
  const publicKey = await importPubKey(strPublicKey);
  const dataBuffer = base64ToArrayBuffer(b64Data);
  const encrypted = await subtle.encrypt({ name: "RSA-OAEP" }, publicKey, dataBuffer);
  return arrayBufferToBase64(encrypted);
}

// Déchiffre un message avec une clé privée et retourne le texte déchiffré encodé en base64
export async function rsaDecrypt(encrypted: Buffer | string, privateKey: CryptoKey): Promise<string> {
  const buffer = typeof encrypted === "string" ? Buffer.from(encrypted, "base64") : encrypted;
  const decrypted = await subtle.decrypt({ name: "RSA-OAEP" }, privateKey, buffer);

  // si l'entrée est une chaîne (test du prof), on retourne base64, sinon UTF-8 (pour le routeur)
  return typeof encrypted === "string"
    ? arrayBufferToBase64(decrypted) 
    : new TextDecoder().decode(decrypted);
}




// ######################
// ### Symmetric keys ###
// ######################

export async function createRandomSymmetricKey(): Promise<webcrypto.CryptoKey> {
  return await subtle.generateKey(
    {
      name: "AES-CBC",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function exportSymKey(key: webcrypto.CryptoKey): Promise<string> {
  const raw = await subtle.exportKey("raw", key);
  return arrayBufferToBase64(raw);
}

export async function importSymKey(keyStr: string): Promise<CryptoKey> {
  const rawKey = Buffer.from(keyStr, "base64");
  return await crypto.subtle.importKey("raw", rawKey, "AES-CBC", true, ["encrypt", "decrypt"]);
}

export async function symEncrypt(key: webcrypto.CryptoKey, data: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const encoded = new TextEncoder().encode(data);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-CBC", iv }, key, encoded);
  const combined = Buffer.concat([Buffer.from(iv), Buffer.from(encrypted)]);
  return combined.toString("base64");
}

async function symDecryptInternal(key: CryptoKey, encryptedData: string): Promise<string> {
  const buffer = base64ToArrayBuffer(encryptedData);
  const iv = buffer.slice(0, 16);
  const ciphertext = buffer.slice(16);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

export async function symDecrypt(key: string | CryptoKey, data: string): Promise<string> {
  const buffer = Buffer.from(data, "base64");
  const iv = buffer.slice(0, 16);
  const ciphertext = buffer.slice(16);
  const cryptoKey = typeof key === "string" ? await importSymKey(key) : key;
  const decrypted = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, cryptoKey, ciphertext);
  return new TextDecoder().decode(decrypted);
}
