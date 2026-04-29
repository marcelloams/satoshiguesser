#!/usr/bin/env node
// Microbenchmark: how long does one spin actually take?
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { BloomFilter } from '../src/game/bloom.js';
import { deriveAll, randomPrivKey } from '../src/game/crypto.js';

const ROOT = resolve(import.meta.dirname, '..');
const bloom = BloomFilter.deserialize(
  readFileSync(resolve(ROOT, 'public/data/satoshi-bloom.bin'))
);

const N = 5000;

// Warmup so JIT settles.
for (let i = 0; i < 200; i++) {
  const d = deriveAll(randomPrivKey());
  bloom.has(d.hash160Compressed);
  bloom.has(d.hash160Uncompressed);
}

let tDerive = 0,
  tBloom = 0,
  hits = 0;

const overall = performance.now();
for (let i = 0; i < N; i++) {
  const priv = randomPrivKey();
  const t1 = performance.now();
  const d = deriveAll(priv);
  const t2 = performance.now();
  const a = bloom.has(d.hash160Compressed);
  const b = bloom.has(d.hash160Uncompressed);
  const t3 = performance.now();
  tDerive += t2 - t1;
  tBloom += t3 - t2;
  if (a || b) hits++;
}
const overallMs = performance.now() - overall;

console.log(`spins:                 ${N}`);
console.log(`address set size:      ${bloom.m / 8} bytes (${bloom.m} bits, k=${bloom.k})`);
console.log(`bloom hits (FPs):      ${hits}`);
console.log('');
console.log(`derive (secp+hash):    avg ${(tDerive / N).toFixed(3)} ms/spin`);
console.log(`bloom check (×2):      avg ${(tBloom / N).toFixed(3)} ms/spin`);
console.log(`total per spin:        avg ${((tDerive + tBloom) / N).toFixed(3)} ms/spin`);
console.log(`throughput:            ~${Math.round(N / (overallMs / 1000))} spins/sec`);
