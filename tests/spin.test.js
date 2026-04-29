// End-to-end-ish: feed known input through the spin pipeline by directly
// exercising the data layer the same way main.js does, but in Node.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sha256 } from '@noble/hashes/sha256';
import { base58check } from '@scure/base';

import { BloomFilter } from '../src/game/bloom.js';
import { WalletTable } from '../src/game/wallet-table.js';
import { deriveAll, hexToBytes } from '../src/game/crypto.js';

const b58c = base58check(sha256);
const ROOT = resolve(import.meta.dirname, '..');

function decodeP2PKH(addr) {
  return b58c.decode(addr).slice(1);
}

test('miss: random key does not match anything', () => {
  const bloom = BloomFilter.deserialize(
    readFileSync(resolve(ROOT, 'public/data/satoshi-bloom.bin'))
  );
  const tbl = new WalletTable(
    readFileSync(resolve(ROOT, 'public/data/satoshi-wallets.bin'))
  );
  const priv = new Uint8Array(32);
  crypto.getRandomValues(priv);
  const d = deriveAll(priv);
  const bloomHit =
    bloom.has(d.hash160Compressed) || bloom.has(d.hash160Uncompressed);
  if (bloomHit) {
    // Confirm against the table — should be null (rare bloom FP).
    const tableHit =
      tbl.lookup(d.hash160Compressed) ?? tbl.lookup(d.hash160Uncompressed);
    assert.equal(tableHit, null, 'bloom hit must be confirmed false by table');
  } else {
    assert.ok(true);
  }
});

test('hit: planted hash160 of genesis matches and reads balance', () => {
  const bloom = BloomFilter.deserialize(
    readFileSync(resolve(ROOT, 'public/data/satoshi-bloom.bin'))
  );
  const tbl = new WalletTable(
    readFileSync(resolve(ROOT, 'public/data/satoshi-wallets.bin'))
  );
  const h160 = decodeP2PKH('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
  assert.ok(bloom.has(h160));
  assert.equal(tbl.lookup(h160), 5_000_000_000n);
});
