class PingOptimizer {
  constructor() {
    this.dnsActive = false;
    this.bufferOptimized = false;
    this.handoverOptimized = false;
    this.currentPing = 0;
    this.init();
  }

  async init() {
    this.setupEventListeners();
    this.loadSettings();
    await this.testPing();
  }

  setupEventListeners() {
    document.getElementById('dns-switch')?.addEventListener('change', e => this.toggleDns(e.target.checked));
    document.getElementById('buffer-switch')?.addEventListener('change', e => this.toggleBufferOptimization(e.target.checked));
    document.getElementById('handover-switch')?.addEventListener('change', e => this.toggleHandoverOptimization(e.target.checked));
    document.getElementById('test-ping-btn')?.addEventListener('click', () => this.testPing());
  }

  loadSettings() {
    ['dns', 'buffer', 'handover'].forEach(k => {
      const v = localStorage.getItem(k + 'OptimizerEnabled') === 'true';
      const el = document.getElementById(k + '-switch');
      if (el) el.checked = v;
    });
  }

  async toggleDns(en) {
    en ? await this.activateDns() : await this.deactivateDns();
    localStorage.setItem('dnsOptimizerEnabled', en);
  }

  async activateDns() {
    await this.withAd();
    const cmds = [
      'cmd netd resolver flushdefaultif',
      'cmd netd resolver flushif wlan0',
      'cmd netd resolver flushif rmnet_data0',
      'cmd netpolicy set restrict-background true',
      'settings put global default_dns_server "1.1.1.1,1.0.0.1"',
      'settings put global dns_resolver_max_samples 1',
      'settings put global dns_resolver_min_samples 1',
      'settings put global dns_resolver_sample_validity_seconds 30',
      'settings put global dns_resolver_success_threshold_percent 100',
      'settings put global preferred_network_mode1 9',
      'settings put global preferred_network_mode2 9',
      'settings put global preferred_network_mode 9,9,9',
      'settings put global private_dns_default_mode hostname',
      'settings put global private_dns_mode hostname',
      'settings put global private_dns_specifier one.one.one.one',
      'settings delete global wifi_power_save',
      'echo "Succes Aktif DNS"'
    ];
    this.runCmds(cmds, 'DNS');
    this.dnsActive = true;
    this.toast('DNS optimization activated');
  }

  async deactivateDns() {
    await this.withAd();
    const cmds = [
      'cmd netpolicy set restrict-background false',
      'for app in $(cmd package list packages -3 --user 0 | cut -f2 -d:); do UID=$(cmd package resolve-uid --user 0 $app 2>/dev/null | grep -oE "[0-9]+"); if [ -n "$UID" ]; then cmd netpolicy remove restrict-background-blacklist $UID; cmd netpolicy remove restrict-background-whitelist $UID; cmd netpolicy remove app-idle-whitelist $UID; fi; done',
      'for NET in $(cmd netpolicy list wifi-networks | awk \'{print $1}\'); do cmd netpolicy set metered-network "$NET" true; done',
      'echo "Succes Nonaktif DNS"'
    ];
    this.runCmds(cmds, 'DNS');
    this.dnsActive = false;
    this.toast('DNS optimization deactivated');
  }

  async toggleBufferOptimization(en) {
    en ? await this.activateBufferOptimization() : await this.deactivateBufferOptimization();
    localStorage.setItem('bufferOptimizerEnabled', en);
  }

  async activateBufferOptimization() {
    await this.withAd();
    const cmds = [
      'settings put global tcp_default_init_rwnd 60',
      'settings put global captive_portal_detection_enabled 0',
      'echo "Succes Aktif Buffer"'
    ];
    this.runCmds(cmds, 'BufferOpt');
    this.bufferOptimized = true;
    this.toast('Buffer optimization activated');
  }

  async deactivateBufferOptimization() {
    await this.withAd();
    const cmds = [
      'settings put global tcp_default_init_rwnd 10',
      'settings put global captive_portal_detection_enabled 1',
      'echo "Succes Nonaktif Buffer"'
    ];
    this.runCmds(cmds, 'BufferOpt');
    this.bufferOptimized = false;
    this.toast('Buffer optimization deactivated');
  }

  async toggleHandoverOptimization(en) {
    en ? await this.activateHandoverOptimization() : await this.deactivateHandoverOptimization();
    localStorage.setItem('handoverOptimizerEnabled', en);
  }

  async activateHandoverOptimization() {
    await this.withAd();
    this.runCmds([
      'settings put global wifi_scan_always_enabled 1',
      'settings put global wifi_sleep_policy 2',
      'echo "Succes Aktif Handover"'
    ], 'Handover');
    this.handoverOptimized = true;
    this.toast('Aggressive handover activated');
  }

  async deactivateHandoverOptimization() {
    await this.withAd();
    this.runCmds([
      'settings put global wifi_scan_always_enabled 0',
      'settings put global wifi_sleep_policy 1',
      'echo "Succes Nonaktif Handover"'
    ], 'Handover');
    this.handoverOptimized = false;
    this.toast('Aggressive handover deactivated');
  }

  runCmds(commands, modName) {
    commands.forEach(c => executeShellCommand(c, modName, `cmd-${Date.now()}-${Math.random()}`));
  }

  async withAd() {
    const alpine = getAlpine();
    alpine.activeModal = 'download';
    const progressBar = document.getElementById('modal-progress');
    const statusText = document.getElementById('modal-status');
    const title = document.getElementById('modal-title');
    title.innerHTML = '<i class="fas fa-ad mr-2"></i>Loading Ad';
    statusText.textContent = 'Starting…';
    progressBar.style.width = '0%';
    let progress = 0;
    await new Promise(resolve => {
      const interval = setInterval(() => {
        progress = Math.min(progress + 20, 100);
        progressBar.style.width = `${progress}%`;
        statusText.textContent = `Progress: ${progress}%`;
        if (progress === 100) {
          clearInterval(interval);
          setTimeout(() => {
            const lastAdTime = localStorage.getItem('lastAdShownTime');
            const currentTime = new Date().getTime();
            const sessionAdShown = sessionStorage.getItem('adShownThisSession');
            
            if (!sessionAdShown && (!lastAdTime || (currentTime - lastAdTime > 60000))) {
              localStorage.setItem('lastAdShownTime', currentTime);
              sessionStorage.setItem('adShownThisSession', 'true');
              window.open('https://obqj2.com/4/9587058', '_blank');
            }
            
            alpine.activeModal = '';
            resolve();
          }, 300);
        }
      }, 300);
    });
  }

  async testPing() {
    const el = document.getElementById('ping-value');
    if (!el) return;
    el.textContent = '…';
    try {
      this.currentPing = await this.measurePing();
      el.textContent = `${this.currentPing} ms`;
      el.style.color = this.currentPing < 50 ? '#4ade80' : this.currentPing < 100 ? '#fbbf24' : '#f87171';
    } catch {
      el.textContent = 'error';
      el.style.color = '#f87171';
    }
  }

  async measurePing() {
    if (!window.Android?.executeCommand) return 999;
    const out = await executeShellCommand('ping -c 1 1.1.1.1', 'PingTest', `ping-${Date.now()}`);
    const m = out.match(/time=(\d+(?:\.\d+)?)\s*ms/);
    return m ? Math.round(parseFloat(m[1])) : 999;
  }

  toast(msg) { getAlpine().showNotification(msg); }
}

document.addEventListener('DOMContentLoaded', () => new PingOptimizer());
