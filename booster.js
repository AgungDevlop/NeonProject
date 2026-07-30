class Booster {
  constructor() {
    this.loop = null;
    this.active = false;
    this.minFps = 60;
    this.maxFps = 60;
    this.init();
  }

  init() {
    const sw = document.getElementById('auto-booster-switch');
    if (!sw) return;
    sw.addEventListener('change', e => this.toggle(e.target.checked));
    this.active = localStorage.getItem('autoBoosterEnabled') === 'true';
    sw.checked = this.active;
    if (this.active) this.start();
  }

  async toggle(en) {
    en ? await this.start() : this.stop();
    localStorage.setItem('autoBoosterEnabled', en);
    const txt = document.getElementById('auto-booster-text');
    if (txt) txt.textContent = en ? 'ACTIVE' : 'IDLE';
  }

  async start() {
    if (this.loop) return;
    this.active = true;
    this.loop = setInterval(() => this.cycle(), 300000);
    await this.cycle();
  }

  stop() {
    this.active = false;
    if (this.loop) clearInterval(this.loop);
    this.loop = null;
  }

  async cycle() {
    if (!this.active) return;
    const cmds = [
      `settings put system min_refresh_rate ${this.minFps}`,
      `settings put system peak_refresh_rate ${this.maxFps}`,
      `settings put global fps ${this.maxFps}`,
      `settings put system refresh_rate_switching 0`,
      `echo "FPS lock applied"`
    ];
    this.runCmds(cmds, 'AutoBooster');
    this.toast('Parameters Applied');
  }

  runCmds(commands, modName) {
    commands.forEach(c => executeShellCommand(c, modName, `cmd-${Date.now()}-${Math.random()}`));
  }

  toast(msg) { getAlpine().showNotification(msg); }
}

document.addEventListener('DOMContentLoaded', () => new Booster());