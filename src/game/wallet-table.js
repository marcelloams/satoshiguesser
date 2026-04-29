// Sorted (hash160, balance_sats) table for confirming Bloom hits and reading
// the prize amount. Layout:
//   magic "WHB1" (4 bytes)
//   count   (uint32 LE)
//   entries: [hash160 (20 bytes) || balance_sats (uint64 LE)] * count
// Sorted ascending by hash160.

const HEADER_BYTES = 8;
const ENTRY_BYTES = 28;
const HASH160_BYTES = 20;
const MAGIC = new Uint8Array([0x57, 0x48, 0x42, 0x31]); // "WHB1"

function writeU32LE(b, o, v) {
  b[o] = v & 0xff;
  b[o + 1] = (v >>> 8) & 0xff;
  b[o + 2] = (v >>> 16) & 0xff;
  b[o + 3] = (v >>> 24) & 0xff;
}

function writeU64LE(b, o, v /* bigint */) {
  for (let i = 0; i < 8; i++) {
    b[o + i] = Number(v & 0xffn);
    v >>= 8n;
  }
}

function readU32LE(b, o) {
  return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
}

function readU64LE(b, o) {
  let v = 0n;
  for (let i = 7; i >= 0; i--) v = (v << 8n) | BigInt(b[o + i]);
  return v;
}

function compareHash160(a, ao, b, bo) {
  for (let i = 0; i < HASH160_BYTES; i++) {
    const d = a[ao + i] - b[bo + i];
    if (d !== 0) return d;
  }
  return 0;
}

export function serializeWalletTable(entries) {
  const sorted = entries.slice().sort((a, b) =>
    compareHash160(a.hash160, 0, b.hash160, 0)
  );
  const out = new Uint8Array(HEADER_BYTES + sorted.length * ENTRY_BYTES);
  out.set(MAGIC, 0);
  writeU32LE(out, 4, sorted.length);
  for (let i = 0; i < sorted.length; i++) {
    const off = HEADER_BYTES + i * ENTRY_BYTES;
    out.set(sorted[i].hash160, off);
    writeU64LE(out, off + HASH160_BYTES, BigInt(sorted[i].balanceSats));
  }
  return out;
}

export class WalletTable {
  constructor(buf) {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    for (let i = 0; i < 4; i++) {
      if (bytes[i] !== MAGIC[i]) throw new Error('bad wallet table magic');
    }
    this.bytes = bytes;
    this.count = readU32LE(bytes, 4);
  }

  /** Returns balance in sats (BigInt) if found, or null. */
  lookup(hash160) {
    let lo = 0;
    let hi = this.count - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      const off = HEADER_BYTES + mid * ENTRY_BYTES;
      const cmp = compareHash160(this.bytes, off, hash160, 0);
      if (cmp === 0) return readU64LE(this.bytes, off + HASH160_BYTES);
      if (cmp < 0) lo = mid + 1;
      else hi = mid - 1;
    }
    return null;
  }
}
