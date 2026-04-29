import { getPublicKey } from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { ripemd160 } from '@noble/hashes/ripemd160';
import { base58check } from '@scure/base';

const b58c = base58check(sha256);

const VERSION_P2PKH_MAINNET = 0x00;
const VERSION_WIF_MAINNET = 0x80;
const COMPRESSED_FLAG = 0x01;

export function hash160(bytes) {
  return ripemd160(sha256(bytes));
}

export function hash160ToAddress(h160) {
  const payload = new Uint8Array(1 + h160.length);
  payload[0] = VERSION_P2PKH_MAINNET;
  payload.set(h160, 1);
  return b58c.encode(payload);
}

export function privKeyToWif(privKey, compressed) {
  const len = compressed ? 34 : 33;
  const payload = new Uint8Array(len);
  payload[0] = VERSION_WIF_MAINNET;
  payload.set(privKey, 1);
  if (compressed) payload[33] = COMPRESSED_FLAG;
  return b58c.encode(payload);
}

export function randomPrivKey() {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return buf;
}

export function deriveAll(privKey) {
  const pubCompressed = getPublicKey(privKey, true);
  const pubUncompressed = getPublicKey(privKey, false);
  const h160c = hash160(pubCompressed);
  const h160u = hash160(pubUncompressed);
  return {
    privKey,
    pubCompressed,
    pubUncompressed,
    hash160Compressed: h160c,
    hash160Uncompressed: h160u,
    addressCompressed: hash160ToAddress(h160c),
    addressUncompressed: hash160ToAddress(h160u),
  };
}

export function bytesToHex(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    s += bytes[i].toString(16).padStart(2, '0');
  }
  return s;
}

export function hexToBytes(hex) {
  if (hex.length % 2) throw new Error('odd hex');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
