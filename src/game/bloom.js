import { sha256 } from '@noble/hashes/sha256';

const HEADER_BYTES = 16;
const MAGIC = new Uint8Array([0x42, 0x4c, 0x4d, 0x31]); // "BLM1"

function readU32LE(bytes, off) {
  return (
    bytes[off] |
    (bytes[off + 1] << 8) |
    (bytes[off + 2] << 16) |
    (bytes[off + 3] << 24) >>> 0
  ) >>> 0;
}

function writeU32LE(bytes, off, v) {
  bytes[off] = v & 0xff;
  bytes[off + 1] = (v >>> 8) & 0xff;
  bytes[off + 2] = (v >>> 16) & 0xff;
  bytes[off + 3] = (v >>> 24) & 0xff;
}

export function optimalParams(n, p) {
  const m = Math.ceil(-(n * Math.log(p)) / (Math.LN2 * Math.LN2));
  const mPadded = (m + 7) & ~7;
  const k = Math.max(1, Math.round((mPadded / n) * Math.LN2));
  return { m: mPadded, k };
}

function hashIndices(item, m, k) {
  // Double-hashing: g_i(x) = h1(x) + i * h2(x) mod m.
  // Take two 32-bit halves from a SHA-256 of the input.
  const h = sha256(item);
  const h1 =
    (h[0] | (h[1] << 8) | (h[2] << 16) | (h[3] << 24)) >>> 0;
  const h2 =
    (h[4] | (h[5] << 8) | (h[6] << 16) | (h[7] << 24)) >>> 0;
  const out = new Uint32Array(k);
  for (let i = 0; i < k; i++) {
    out[i] = (h1 + Math.imul(i, h2)) >>> 0;
    out[i] = out[i] % m;
  }
  return out;
}

export class BloomFilter {
  constructor(m, k, bits) {
    this.m = m;
    this.k = k;
    this.bits = bits ?? new Uint8Array(m / 8);
  }

  static create(n, p) {
    const { m, k } = optimalParams(n, p);
    return new BloomFilter(m, k);
  }

  add(item) {
    const idx = hashIndices(item, this.m, this.k);
    for (let i = 0; i < idx.length; i++) {
      const bit = idx[i];
      this.bits[bit >>> 3] |= 1 << (bit & 7);
    }
  }

  has(item) {
    const idx = hashIndices(item, this.m, this.k);
    for (let i = 0; i < idx.length; i++) {
      const bit = idx[i];
      if ((this.bits[bit >>> 3] & (1 << (bit & 7))) === 0) return false;
    }
    return true;
  }

  serialize(n) {
    const out = new Uint8Array(HEADER_BYTES + this.bits.length);
    out.set(MAGIC, 0);
    writeU32LE(out, 4, n);
    writeU32LE(out, 8, this.m);
    out[12] = this.k;
    out.set(this.bits, HEADER_BYTES);
    return out;
  }

  static deserialize(buf) {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    for (let i = 0; i < 4; i++) {
      if (bytes[i] !== MAGIC[i]) throw new Error('bad bloom magic');
    }
    const m = readU32LE(bytes, 8);
    const k = bytes[12];
    const bits = bytes.slice(HEADER_BYTES, HEADER_BYTES + m / 8);
    return new BloomFilter(m, k, bits);
  }
}
