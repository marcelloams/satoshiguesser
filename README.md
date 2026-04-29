# Satoshi Guesser

A slot-machine web game that "guesses" Satoshi Nakamoto's Bitcoin private
keys. The odds are astronomically remote (~1 in 5.27 × 10⁷² per spin), but
the cryptography is real: every pull rolls a random 256-bit number, derives
the Bitcoin address, and checks it against a curated set of ~22,000
Patoshi-pattern coinbase addresses plus the genesis block. If the derived
address ever matches, the random number you rolled **is** the working
private key for that wallet — no server, no API, no catch.

Live at **[satoshiguesser.com](https://satoshiguesser.com)** (when deployed).

---

## How it works (no blockchain required)

Bitcoin's address derivation is a one-way deterministic chain:

```
random 256-bit number  ──►  secp256k1 public key  ──►  HASH160  ──►  Base58Check address
   (private key)              (point on curve)         (RIPEMD160(SHA256))
```

Every Bitcoin address has exactly one private key that controls it. So when
the game generates a random 256-bit number, that number **is** a valid
private key — it just controls some random address with (almost certainly)
zero balance. If that derived address ever matches one of Satoshi's, the
random number is the private key to that wallet, full stop. The math is
the verification.

What ships with the page (at build time):

1. The set of Satoshi-attributed addresses, as a Bloom filter for fast
   lookup (~135 KB) plus a sorted (hash160, balance_sats) table for prize
   readout (~615 KB, lazy-loaded only on a Bloom hit).
2. A hardcoded BTC/USD constant with a snapshot date.

Nothing else. No node connection, no API call, no telemetry.

---

## Features

- **Two reel modes:** classic 3-reel ✗/✓, or "realistic" 64 hex cells that
  reveal the full candidate private key with red/green flash on result.
- **No-delay toggle:** skip animations, snap results in synchronously.
  Spam-clickable as fast as your finger goes (~2,500 spins/sec headroom).
- **Autospin:** chains spins automatically. 250 ms between spins normally;
  drops to 16 ms (one paint frame) when no-delay is also on. Auto-pauses
  on win.
- **Live header:** jackpot in BTC and USD, per-spin odds, wallet count,
  price snapshot date, "Win up to X billion dollars!" tagline (computed,
  not hardcoded).
- **Win UX:** modal with the matched address, the WIF private key, the
  prize in BTC and USD, "Copy" button, confetti, and a win-arpeggio sound.
- **Dev-win flag:** append `?devwin=1` to the URL to force a "win" against
  the genesis address. The shown WIF won't actually unlock anything (we
  don't have Satoshi's key) — it's purely for verifying the win UI.
- **Synthesised audio:** lever click, reel-stop tick, lose thunk, win
  arpeggio. Generated via Web Audio API — no asset downloads.
- **Spacebar** also pulls the lever.

---

## Quick start

Requires Node 22 or newer.

```bash
npm install
npm run dev          # http://localhost:5173
```

The `predev` hook regenerates `public/data/satoshi-bloom.bin`,
`satoshi-wallets.bin`, and `wallet-stats.json` from `data/wallets.csv` on
every dev start, so editing the CSV propagates automatically.

```bash
npm run build        # production bundle in dist/
npm run preview      # serve dist/ for a final smoke test
npm test             # 11 unit/integration tests
```

---

## Project layout

```
SatoshiGuesser/
├── index.html                    # single page, no framework
├── src/
│   ├── main.js                   # app entry: wires UI, audio, game loop
│   ├── game/
│   │   ├── crypto.js             # privkey → secp256k1 → HASH160 → P2PKH; WIF
│   │   ├── bloom.js              # Bloom filter (serialise + has/add)
│   │   ├── wallet-table.js       # sorted (hash160, balance) binary search
│   │   ├── wallets.js            # lazy-loads bloom + table; checkHash160s()
│   │   └── spin.js               # one-spin pipeline; supports devwin override
│   ├── ui/
│   │   ├── log.js                # rolling log textarea
│   │   ├── slot-classic.js       # 3-reel ✗/✓ animation
│   │   ├── slot-realistic.js     # 64 hex cells with red/green flash
│   │   └── win-dialog.js         # modal + confetti + clipboard
│   ├── audio/audio.js            # Web Audio synthesised SFX
│   └── styles/{main,slot}.css
├── data/
│   └── wallets.csv               # canonical input — 21,954 addresses + balances
├── scripts/
│   ├── fetch-patoshi.js          # downloads bensig CSV → data/wallets.csv
│   ├── build-wallet-set.js       # data/wallets.csv → public/data/*.bin
│   └── bench-spin.js             # microbench (per-spin cost)
├── public/
│   ├── data/                     # generated artifacts (gitignored)
│   └── audio/                    # reserved for future audio assets
├── tests/
│   ├── crypto.test.js            # known privkey/pubkey/WIF vectors + genesis
│   ├── wallets.test.js           # bloom + table round-trip
│   └── spin.test.js              # end-to-end-ish miss/hit
├── PLAN.md                       # original design plan
└── package.json
```

---

## The wallet dataset

`data/wallets.csv` is the canonical input. Format:

```csv
# comments OK; blank lines OK
address,balance_btc[,note]
1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa,50.0,Genesis
12c6DSiU4Rq3P4ZxziKxzrL5LmMBrzjrJX,50.0
1HLoD9E4SDFFPDiYfNYnkBLQ85Y51J3Zb1     # balance defaults to 50 BTC
```

The current file holds **21,954 unique addresses** totalling
**1,097,702.49 BTC** — 21,953 Patoshi-pattern coinbase outputs plus the
genesis block.

### Regenerating from upstream

```bash
npm run fetch:patoshi      # downloads + converts P2PK → P2PKH addresses
npm run build:wallets      # rebuilds bloom + sorted table
```

The fetcher pulls
[bensig/patoshi-addresses](https://github.com/bensig/patoshi-addresses)
(curated by Sergio Demian Lerner / Jameson Lopp), hex-decodes each P2PK
uncompressed public key to its P2PKH address, aggregates by address (in
case any two coinbases share a key), appends the genesis address as a
supplement, and writes a sorted, self-documenting CSV.

### Build-time artifacts

`scripts/build-wallet-set.js` emits three files into `public/data/` (all
gitignored — they're rebuilt from `wallets.csv`):

| File                  | Format                                                   | Size  |
| --------------------- | -------------------------------------------------------- | ----- |
| `satoshi-bloom.bin`   | Bloom filter, m=1,078,320 bits, k=30, p≈10⁻⁹             | 135 KB |
| `satoshi-wallets.bin` | Sorted `(hash160, balance_sats)` table, 28 bytes/entry   | 615 KB |
| `wallet-stats.json`   | Counts, totals, BTC/USD price, snapshot date             | < 1 KB |

The Bloom filter is sized for 25,000 entries to leave headroom for future
updates without changing the FP rate.

---

## Configuration

Two constants live in `scripts/build-wallet-set.js`:

```js
const BTC_USD_APPROX = 76_228.52;      // refresh near deploy time
const PRICE_SNAPSHOT_DATE = …;          // auto-set to build date
```

Refresh the price, run `npm run build:wallets` (or just rebuild — `prebuild`
runs it), and the header strip + tagline update automatically.

The autospin delays live in `src/main.js`:

```js
const AUTOSPIN_DELAY_MS = 250;          // normal autospin pacing
const AUTOSPIN_DELAY_NO_DELAY_MS = 16;  // when "No delay" is also on
```

---

## Tests

```bash
npm test
```

11 tests covering:

- known privkey → pubkey → P2PKH address vectors (Bitcoin wiki test vectors)
- WIF encoding (uncompressed and compressed)
- HASH160 round-trip
- Bloom filter add / has + serialise / deserialise
- Sorted table binary-search hit and miss
- End-to-end miss path (random key against the real bloom)
- Planted hit path (genesis hash160 → balance)

---

## Performance

Benchmark (`npm run bench` — well, `node scripts/bench-spin.js`):

```
spins:                 5000
address set size:      134790 bytes (1078320 bits, k=30)
bloom hits (FPs):      0
derive (secp+hash):    avg 0.391 ms/spin
bloom check (×2):      avg 0.004 ms/spin
total per spin:        avg 0.396 ms/spin
throughput:            ~2490 spins/sec
```

The Bloom check is **independent of address-set size** — k=30 hash lookups
regardless of n. 99% of per-spin cost is the elliptic-curve point
multiplication. The data set could grow 100× and you'd notice the page
being heavier on first load and absolutely nothing else at runtime.

---

## Deploy to Cloudflare Pages

This is a static site — no Workers, no Durable Objects, no R2.

### Path A — Pages + Git (recommended)

1. Push the repo to GitHub.
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → connect repo.
3. Build settings:
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: (blank)
4. Save and deploy. Auto-redeploys on every push.
5. **Custom domain** → add `satoshiguesser.com` and `www.satoshiguesser.com`. If the
   domain is in your Cloudflare account, DNS auto-wires.

### Path B — Wrangler direct upload

```bash
npm install -D wrangler
npx wrangler login
npm run build
npx wrangler pages deploy dist --project-name satoshi-guesser
```

### Pre-flight

- `data/wallets.csv` is committed (build needs it).
- `public/data/*.bin` and `wallet-stats.json` are gitignored — they
  regenerate via the `prebuild` hook in CI.
- Node 22 LTS or newer (Pages default works).

---

## The odds, for context

```
keyspace        = 2^256              ≈ 1.158 × 10⁷⁷ valid private keys
satoshi addrs   = 21,954
odds per spin   = 21,954 / 2^256     ≈ 1 in 5.27 × 10⁷²
```

For scale: about **10 million times harder** than picking one specific
atom from the entire observable universe. At one spin per millisecond
(faster than this app runs), you'd expect a hit roughly once per
1.7 × 10⁶² years — about 10⁵² times the current age of the universe. The
heat death of the universe occurs first, by a comically wide margin.

---

## Credits

- **Sergio Demian Lerner** — discoverer of the Patoshi pattern.
- **Jameson Lopp** — curated dataset.
- **[bensig/patoshi-addresses](https://github.com/bensig/patoshi-addresses)**
  — distribution of the curated CSV used by the fetch script.
- **[@noble/secp256k1](https://github.com/paulmillr/noble-secp256k1),
  [@noble/hashes](https://github.com/paulmillr/noble-hashes),
  [@scure/base](https://github.com/paulmillr/scure-base)** — Paul Miller's
  audited, dependency-free crypto primitives.
- **[canvas-confetti](https://github.com/catdad/canvas-confetti)** — the
  confetti.

---

## License

MIT
