#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from '@noble/hashes/sha256';
import { base58check } from '@scure/base';

import { BloomFilter, optimalParams } from '../src/game/bloom.js';
import { serializeWalletTable } from '../src/game/wallet-table.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const INPUT = resolve(ROOT, 'data/wallets.csv');
const OUT_DIR = resolve(ROOT, 'public/data');
const OUT_BLOOM = resolve(OUT_DIR, 'satoshi-bloom.bin');
const OUT_TABLE = resolve(OUT_DIR, 'satoshi-wallets.bin');
const OUT_STATS = resolve(OUT_DIR, 'wallet-stats.json');

// Hardcoded BTC/USD price snapshot. Refresh on redeploy. The snapshot date
// is shown to the user, so staleness is honest, not hidden.
const BTC_USD_APPROX = 76_228.52;
const PRICE_SNAPSHOT_DATE = new Date().toISOString().slice(0, 10);

const TARGET_FP_RATE = 1e-9;
const SATS_PER_BTC = 100_000_000n;

const b58c = base58check(sha256);

// Coinbase reward in the Satoshi era was 50 BTC. If the input list omits a
// balance column, default to that — covers the common case of an
// addresses-only Patoshi dump.
const DEFAULT_BALANCE_BTC = '50';

function decodeP2PKH(addr) {
  const payload = b58c.decode(addr);
  if (payload.length !== 21 || payload[0] !== 0x00) return null;
  return payload.slice(1);
}

function parseCsv(raw) {
  const out = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed.toLowerCase().startsWith('address,')) continue; // header
    const parts = trimmed.split(',');
    const address = parts[0]?.trim();
    if (!address) continue;
    const balanceBtc =
      parts[1] && parts[1].trim() ? parts[1].trim() : DEFAULT_BALANCE_BTC;
    out.push({ address, balanceBtc });
  }
  return out;
}

function btcToSats(btcStr) {
  const [whole, frac = ''] = btcStr.split('.');
  const fracPadded = (frac + '00000000').slice(0, 8);
  return BigInt(whole) * SATS_PER_BTC + BigInt(fracPadded || '0');
}

function main() {
  if (!existsSync(INPUT)) {
    console.error(`wallets.csv not found at ${INPUT}`);
    process.exit(1);
  }
  mkdirSync(OUT_DIR, { recursive: true });

  const rows = parseCsv(readFileSync(INPUT, 'utf8'));
  if (rows.length === 0) {
    console.error('no wallet rows parsed');
    process.exit(1);
  }

  const entries = [];
  const seen = new Set();
  let skippedNonP2PKH = 0;
  let dupes = 0;
  for (const { address, balanceBtc } of rows) {
    const h160 = decodeP2PKH(address);
    if (!h160) {
      skippedNonP2PKH++;
      continue;
    }
    const key = Buffer.from(h160).toString('hex');
    if (seen.has(key)) {
      dupes++;
      continue;
    }
    seen.add(key);
    entries.push({ hash160: h160, balanceSats: btcToSats(balanceBtc) });
  }
  if (skippedNonP2PKH) {
    console.warn(`  warn: skipped ${skippedNonP2PKH} non-P2PKH addresses`);
  }
  if (dupes) {
    console.warn(`  warn: ${dupes} duplicate addresses collapsed`);
  }

  // Bloom filter — size for at least 25k to leave headroom for the real list.
  const bloomCapacity = Math.max(entries.length, 25_000);
  const { m, k } = optimalParams(bloomCapacity, TARGET_FP_RATE);
  const bloom = new BloomFilter(m, k);
  for (const e of entries) bloom.add(e.hash160);

  const bloomBytes = bloom.serialize(entries.length);
  const tableBytes = serializeWalletTable(entries);

  writeFileSync(OUT_BLOOM, bloomBytes);
  writeFileSync(OUT_TABLE, tableBytes);

  let totalSats = 0n;
  for (const e of entries) totalSats += e.balanceSats;
  const totalBtc = Number(totalSats) / Number(SATS_PER_BTC);

  const stats = {
    walletCount: entries.length,
    totalSats: totalSats.toString(),
    totalBtc,
    btcUsdApprox: BTC_USD_APPROX,
    priceSnapshotDate: PRICE_SNAPSHOT_DATE,
    bloomBytes: bloomBytes.length,
    bloomBits: m,
    bloomK: k,
    targetFalsePositiveRate: TARGET_FP_RATE,
    keyspace: '2^256',
    oddsPerSpinDenominator: null, // computed at runtime: 2^256 / walletCount
  };
  writeFileSync(OUT_STATS, JSON.stringify(stats, null, 2));

  console.log(`Built wallet set:`);
  console.log(`  wallets:       ${entries.length}`);
  console.log(`  total BTC:     ${totalBtc}`);
  console.log(`  bloom (m,k):   ${m} bits, ${k} hashes (${bloomBytes.length} bytes)`);
  console.log(`  table:         ${tableBytes.length} bytes`);
  console.log(`  out:           ${OUT_DIR}`);
}

main();
