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
    document.getElementById('auto-booster-text').textContent = en ? 'On' : 'Off';
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
    await this.withAd();
    const cmds = [
      `settings put system min_refresh_rate ${this.minFps}`,
      `settings put system peak_refresh_rate ${this.maxFps}`,
      `settings put global fps ${this.maxFps}`,
      `settings put system refresh_rate_switching 0`,
      `echo "FPS tweaks applied"`
    ];
    this.runCmds(cmds, 'AutoBooster');
    this.toast('FPS tweaks applied');
  }

  runCmds(commands, modName) {
    commands.forEach(c => executeShellCommand(c, modName, `cmd-${Date.now()}-${Math.random()}`));
  }

  async withAd() {
    const alpine = getAlpine();
    alpine.activeModal = 'download';
    const bar = document.getElementById('modal-progress');
    const txt = document.getElementById('modal-status');
    const ttl = document.getElementById('modal-title');
    ttl.innerHTML = '<i class="fas fa-ad mr-2"></i>Loading Ad';
    txt.textContent = 'Starting…';
    bar.style.width = '0%';
    let prg = 0;
    await new Promise(r => {
      const iv = setInterval(() => {
        prg = Math.min(prg + 20, 100);
        bar.style.width = `${prg}%`;
        txt.textContent = `Progress: ${prg}%`;
        if (prg === 100) {
          clearInterval(iv);
          setTimeout(() => {
            const last = localStorage.getItem('lastAdShownTime');
            const now = new Date().getTime();
            const sess = sessionStorage.getItem('adShownThisSession');
            if (!sess && (!last || now - last > 60000)) {
              localStorage.setItem('lastAdShownTime', now);
              sessionStorage.setItem('adShownThisSession', 'true');
              window.open('https://obqj2.com/4/9587058', '_blank');
            }
            alpine.activeModal = '';
            r();
          }, 300);
        }
      }, 300);
    });
  }

  toast(msg) { getAlpine().showNotification(msg); }
}

document.addEventListener('DOMContentLoaded', () => new Booster());