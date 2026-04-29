import confetti from 'canvas-confetti';
import { hash160ToAddress, privKeyToWif } from '../game/crypto.js';

const SATS_PER_BTC = 100_000_000;

function fmtBtc(sats) {
  const btc = Number(sats) / SATS_PER_BTC;
  return `${btc.toFixed(8)} BTC`;
}

function fmtUsd(sats, btcUsd) {
  const btc = Number(sats) / SATS_PER_BTC;
  const usd = btc * btcUsd;
  if (usd >= 1_000_000) return `≈ $${(usd / 1_000_000).toFixed(2)}M`;
  if (usd >= 1_000) return `≈ $${(usd / 1_000).toFixed(1)}K`;
  return `≈ $${usd.toFixed(0)}`;
}

export class WinDialog {
  constructor(dialog, btcUsd) {
    this.dialog = dialog;
    this.btcUsd = btcUsd;
    dialog.querySelector('#win-close').addEventListener('click', () => {
      dialog.close();
    });
    dialog.querySelector('#win-copy').addEventListener('click', async () => {
      const wif = dialog.querySelector('#win-wif').textContent;
      try {
        await navigator.clipboard.writeText(wif);
        const btn = dialog.querySelector('#win-copy');
        const orig = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => (btn.textContent = orig), 1500);
      } catch {
        /* clipboard denied — user can select manually */
      }
    });
  }

  show({ privKey, derived, match }) {
    const address = hash160ToAddress(match.hash160);
    // The WIF compression flag must match the hash160 we matched on. We try
    // the compressed form first, then fall back.
    const compressed =
      derived.hash160Compressed.every((b, i) => b === match.hash160[i]);
    const wif = privKeyToWif(privKey, compressed);

    this.dialog.querySelector('#win-address').textContent = address;
    this.dialog.querySelector('#win-wif').textContent = wif;
    this.dialog.querySelector('#win-btc').textContent = fmtBtc(
      match.balanceSats
    );
    this.dialog.querySelector('#win-usd').textContent = fmtUsd(
      match.balanceSats,
      this.btcUsd
    );

    if (typeof this.dialog.showModal === 'function') {
      this.dialog.showModal();
    } else {
      this.dialog.setAttribute('open', '');
    }

    fireConfetti();
  }
}

function fireConfetti() {
  const burst = (opts) =>
    confetti({
      particleCount: 100,
      spread: 75,
      origin: { y: 0.6 },
      ...opts,
    });
  burst({});
  setTimeout(() => burst({ angle: 60, origin: { x: 0, y: 0.7 } }), 200);
  setTimeout(() => burst({ angle: 120, origin: { x: 1, y: 0.7 } }), 400);
}
