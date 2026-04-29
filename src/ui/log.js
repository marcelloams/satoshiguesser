const MAX_LINES = 200;

export class Log {
  constructor(textarea) {
    this.el = textarea;
    this.lines = [];
  }

  append(line) {
    const ts = new Date().toLocaleTimeString('en-GB', { hour12: false });
    this.lines.push(`[${ts}] ${line}`);
    if (this.lines.length > MAX_LINES) {
      this.lines.splice(0, this.lines.length - MAX_LINES);
    }
    this.el.value = this.lines.join('\n');
    this.el.scrollTop = this.el.scrollHeight;
  }
}
