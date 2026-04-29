const SYMBOLS = ['?', '$', 'B', '#', '%', '*'];

function setReel(reelEl, symbol, cls) {
  const span = reelEl.querySelector('.reel-symbol');
  span.textContent = symbol;
  reelEl.classList.remove('win', 'lose', 'spinning');
  if (cls) reelEl.classList.add(cls);
}

export class ClassicReels {
  constructor(container) {
    this.container = container;
    this.reels = [...container.querySelectorAll('.reel')];
  }

  show() {
    this.container.classList.remove('hidden');
  }
  hide() {
    this.container.classList.add('hidden');
  }

  startSpin() {
    this.reels.forEach((r) => {
      r.classList.add('spinning');
      r.classList.remove('win', 'lose');
    });
    // Tick animation: cycle symbols.
    this._tickHandle = setInterval(() => {
      this.reels.forEach((r) => {
        const s = SYMBOLS[(Math.random() * SYMBOLS.length) | 0];
        r.querySelector('.reel-symbol').textContent = s;
      });
    }, 70);
  }

  async stopSpin(win) {
    clearInterval(this._tickHandle);
    const symbol = win ? '✓' : '✗';
    const cls = win ? 'win' : 'lose';
    for (let i = 0; i < this.reels.length; i++) {
      await new Promise((r) => setTimeout(r, 220));
      setReel(this.reels[i], symbol, cls);
    }
  }

  flashResult(win) {
    clearInterval(this._tickHandle);
    const symbol = win ? '✓' : '✗';
    const cls = win ? 'win' : 'lose';
    for (let i = 0; i < this.reels.length; i++) {
      setReel(this.reels[i], symbol, cls);
    }
  }
}
