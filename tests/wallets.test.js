import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sha256 } from '@noble/hashes/sha256';
import { base58check } from '@scure/base';

import { BloomFilter } from '../src/game/bloom.js';
import { WalletTable } from '../src/game/wallet-table.js';

const b58c = base58check(sha256);

function decodeP2PKH(addr) {
  const payload = b58c.decode(addr);
  return payload.slice(1);
}

const ROOT = resolve(import.meta.dirname, '..');

test('bloom filter recognises genesis address', () => {
  const buf = readFileSync(resolve(ROOT, 'public/data/satoshi-bloom.bin'));
  const bloom = BloomFilter.deserialize(buf);
  const genesisH160 = decodeP2PKH('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
  assert.ok(bloom.has(genesisH160));
});

test('bloom filter rejects random hash160', () => {
  const buf = readFileSync(resolve(ROOT, 'public/data/satoshi-bloom.bin'));
  const bloom = BloomFilter.deserialize(buf);
  const random = new Uint8Array(20);
  crypto.getRandomValues(random);
  // With p=1e-9 and k=30, a single random check is overwhelmingly unlikely
  // to collide. (Could be flaky in theory; flake rate ~1e-9.)
  assert.equal(bloom.has(random), false);
});

test('wallet table returns correct balance for genesis', () => {
  const buf = readFileSync(resolve(ROOT, 'public/data/satoshi-wallets.bin'));
  const tbl = new WalletTable(buf);
  const genesisH160 = decodeP2PKH('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
  const sats = tbl.lookup(genesisH160);
  assert.equal(sats, 5_000_000_000n);
});

test('wallet table returns null for unknown hash160', () => {
  const buf = readFileSync(resolve(ROOT, 'public/data/satoshi-wallets.bin'));
  const tbl = new WalletTable(buf);
  const random = new Uint8Array(20);
  crypto.getRandomValues(random);
  assert.equal(tbl.lookup(random), null);
});
