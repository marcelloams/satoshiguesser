const HEX = '0123456789abcdef';
const KEY_NIBBLES = 64;

export class RealisticReels {
  constructor(container) {
    this.container = container;
    this.cells = [];
    this.build();
  }

  build() {
    this.container.innerHTML = '';
    this.cells = [];
    for (let i = 0; i < KEY_NIBBLES; i++) {
      const c = document.createElement('div');
      c.className = 'hex-cell';
      c.textContent = '·';
      this.container.appendChild(c);
      this.cells.push(c);
    }
  }

  show() {
    this.container.classList.remove('hidden');
  }
  hide() {
    this.container.classList.add('hidden');
  }

  startSpin() {
    this.cells.forEach((c) => c.classList.remove('win', 'lose'));
    this._tickHandle = setInterval(() => {
      for (let i = 0; i < this.cells.length; i++) {
        this.cells[i].textContent = HEX[(Math.random() * 16) | 0];
      }
    }, 35);
  }

  async stopSpin(privKeyHex, win) {
    clearInterval(this._tickHandle);
    const cls = win ? 'win' : 'lose';
    // Reveal left-to-right with a tiny stagger so it feels like reels
    // landing rather than a single flash.
    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i].textContent = privKeyHex[i];
      this.cells[i].classList.add(cls);
      if (i % 4 === 3) await new Promise((r) => setTimeout(r, 12));
    }
  }

  flashResult(privKeyHex, win) {
    clearInterval(this._tickHandle);
    const cls = win ? 'win' : 'lose';
    const otherCls = win ? 'lose' : 'win';
    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i].textContent = privKeyHex[i];
      this.cells[i].classList.remove(otherCls);
      this.cells[i].classList.add(cls);
    }
  }
}
