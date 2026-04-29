#!/usr/bin/env node
// Fetches the curated Patoshi-pattern coinbase output dataset and writes it
// to data/wallets.csv in the format the build script expects.
//
// Source: https://github.com/bensig/patoshi-addresses
// Curation: Sergio Demian Lerner (pattern), Jameson Lopp (dataset).
//
// The upstream CSV holds one row per coinbase output:
//   Block Height,Output Index,Address/Pubkey,Amount (BTC),Script Type
// where Script Type is "p2pk" (uncompressed hex pubkey) or "p2pkh" (address).
// We convert all of them to P2PKH addresses and aggregate balances per
// unique address.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from '@noble/hashes/sha256';
import { ripemd160 } from '@noble/hashes/ripemd160';
import { base58check } from '@scure/base';

const SOURCE_URL =
  'https://raw.githubusercontent.com/bensig/patoshi-addresses/main/patoshi_pubkeys_COMPLETE.csv';

// Universally attributed to Satoshi but outside Lerner's Patoshi pattern
// (which starts at block 3). We append these so the game includes the
// addresses a player would actually expect to see.
const SUPPLEMENT = [
  {
    address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    btc: 50,
    note: 'Block 0 — genesis coinbase',
  },
];

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT = resolve(ROOT, 'data/wallets.csv');

const b58c = base58check(sha256);

function hexToBytes(hex) {
  if (hex.length % 2) throw new Error('odd hex');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function pubkeyHexToP2PKH(pubHex) {
  const bytes = hexToBytes(pubHex);
  const h160 = ripemd160(sha256(bytes));
  const payload = new Uint8Array(21);
  payload[0] = 0x00;
  payload.set(h160, 1);
  return b58c.encode(payload);
}

function parseCsvLine(line) {
  // Simple split — the upstream file has no quoted fields with commas.
  return line.split(',').map((s) => s.trim());
}

async function main() {
  process.stdout.write(`Fetching ${SOURCE_URL} …\n`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) {
    console.error(`HTTP ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const text = await res.text();
  const lines = text.split(/\r?\n/);
  process.stdout.write(`  downloaded ${text.length} bytes, ${lines.length} lines\n`);

  // Aggregate balances per unique address. (Patoshi blocks are believed to
  // each pay a unique key, but we aggregate defensively in case two
  // coinbases share an address.)
  const balances = new Map(); // address -> btc total (number)
  let p2pkRows = 0;
  let p2pkhRows = 0;
  let skipped = 0;
  let totalBtc = 0;
  let minHeight = Infinity;
  let maxHeight = -Infinity;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.toLowerCase().startsWith('block height,')) continue; // header

    const fields = parseCsvLine(line);
    if (fields.length < 5) {
      skipped++;
      continue;
    }
    const [heightStr, , addrOrPub, amountStr, scriptType] = fields;
    const height = Number(heightStr);
    const amount = Number(amountStr);
    if (!Number.isFinite(amount)) {
      skipped++;
      continue;
    }
    if (Number.isFinite(height)) {
      if (height < minHeight) minHeight = height;
      if (height > maxHeight) maxHeight = height;
    }

    let address;
    const type = (scriptType || '').toLowerCase();
    if (type === 'p2pk') {
      try {
        address = pubkeyHexToP2PKH(addrOrPub.toLowerCase());
      } catch (err) {
        skipped++;
        continue;
      }
      p2pkRows++;
    } else if (type === 'p2pkh') {
      address = addrOrPub;
      p2pkhRows++;
    } else {
      skipped++;
      continue;
    }

    balances.set(address, (balances.get(address) || 0) + amount);
    totalBtc += amount;
  }

  if (balances.size === 0) {
    console.error('No rows parsed — upstream format changed?');
    process.exit(1);
  }

  // Append supplement (genesis etc.) — dedupe against the upstream set.
  let supplementAdded = 0;
  for (const { address, btc } of SUPPLEMENT) {
    if (!balances.has(address)) {
      balances.set(address, btc);
      totalBtc += btc;
      supplementAdded++;
    }
  }

  // Write data/wallets.csv.
  mkdirSync(dirname(OUT), { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  const out = [];
  out.push('# Patoshi-pattern coinbase outputs + a small supplement.');
  out.push(`# Source:     ${SOURCE_URL}`);
  out.push('# Curators:   Sergio Demian Lerner (pattern), Jameson Lopp (dataset).');
  out.push(`# Fetched:    ${today}`);
  out.push(`# Range:      blocks ${minHeight}-${maxHeight}`);
  out.push(`# Rows in:    ${p2pkRows + p2pkhRows} (p2pk=${p2pkRows}, p2pkh=${p2pkhRows}, skipped=${skipped})`);
  out.push(`# Supplement: ${supplementAdded} address(es) appended (e.g. genesis, outside Lerner's pattern but universally attributed to Satoshi)`);
  out.push(`# Unique:     ${balances.size} addresses`);
  out.push(`# Total:      ${totalBtc.toFixed(8)} BTC`);
  out.push('address,balance_btc');
  // Sort by address for stable diffs.
  const sorted = [...balances.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  for (const [addr, btc] of sorted) {
    out.push(`${addr},${btc.toFixed(8)}`);
  }
  writeFileSync(OUT, out.join('\n') + '\n');

  console.log(`\nWrote ${OUT}`);
  console.log(`  block range:    ${minHeight}-${maxHeight}`);
  console.log(`  rows in:        ${p2pkRows + p2pkhRows} (p2pk=${p2pkRows}, p2pkh=${p2pkhRows})`);
  console.log(`  skipped:        ${skipped}`);
  console.log(`  supplement:     ${supplementAdded} added`);
  console.log(`  unique addrs:   ${balances.size}`);
  console.log(`  total BTC:      ${totalBtc.toFixed(2)}`);

  // Sanity checks against published numbers.
  const expectedMin = 21_000;
  const expectedMax = 23_000;
  const expectedBtcMin = 1_050_000;
  const expectedBtcMax = 1_150_000;
  if (balances.size < expectedMin || balances.size > expectedMax) {
    console.warn(
      `\n  WARN: address count ${balances.size} outside expected range [${expectedMin}, ${expectedMax}]`
    );
  }
  if (totalBtc < expectedBtcMin || totalBtc > expectedBtcMax) {
    console.warn(
      `  WARN: total BTC ${totalBtc.toFixed(2)} outside expected range [${expectedBtcMin}, ${expectedBtcMax}]`
    );
  }

  console.log(`\nNext: npm run build:wallets`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
