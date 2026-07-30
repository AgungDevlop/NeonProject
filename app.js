const LANG_URL = "lang.json";
const VERSION_URL = "version.json";
const COMMANDS_URL = "commands.json";
const RESTORE_URL = "restore.json";
const FPS_MODULES_URL = "https://raw.githubusercontent.com/AgungDevlop/Viral/refs/heads/main/FpsSetting.json";
const FAKE_DEVICE_URL = "https://raw.githubusercontent.com/AgungDevlop/Viral/main/FakeDevice.json";
const GAME_JSON_URL = "game.json";
const PERFORMANCE_JSON_URL = "performance.json";

let LANGUAGES = {};
let currentLanguage = localStorage.getItem('language') || 'en';

let COMMANDS = {}, RESTORE_COMMANDS = {}, PERFORMANCE_COMMANDS = {};
let tweakSettings = {};
let allFpsModules = [], allFakeDevices = [], allGames = [];
let lastFoundGames = [];
let boostState = {};

const downloadedModules = new Set(JSON.parse(localStorage.getItem("downloadedModules") || "[]"));
const activeModules = new Set(JSON.parse(localStorage.getItem("activeModules") || "[]"));
const activeFakeDevices = new Set(JSON.parse(localStorage.getItem("activeFakeDevices") || "[]"));
const selectedGames = new Set(JSON.parse(localStorage.getItem("selectedGames") || "[]"));
let commandLogs = JSON.parse(localStorage.getItem("commandLogs") || "[]");

async function loadLanguages() {
    return Promise.resolve(true);
}

function getLangString(key, replacements = {}) {
    if (!key) return '';
    let str = key.replace(/_/g, ' ');
    for (const placeholder in replacements) {
        str = str.replace(`{${placeholder}}`, replacements[placeholder] || '');
    }
    return str;
}

function translateUI() {
    document.querySelectorAll('[data-lang-key-placeholder]').forEach(el => {
        const key = el.getAttribute('data-lang-key-placeholder');
        if (key && !el.getAttribute('placeholder')) {
            el.placeholder = getLangString(key);
        }
    });
}

function setLanguage(lang) {
    changeLang(lang);
}

function changeLang(lang) {
    localStorage.setItem('language', lang);
    document.cookie = `googtrans=/auto/${lang}; path=/`;
    document.cookie = `googtrans=/auto/${lang}; domain=${location.hostname}; path=/`;
    
    const combo = document.querySelector('.goog-te-combo');
    if (combo) {
        combo.value = lang;
        combo.dispatchEvent(new Event('change'));
    } else {
        location.reload();
    }
    
    const alpine = getAlpine();
    if (alpine) alpine.activeModal = '';
}

document.addEventListener('DOMContentLoaded', () => {
    const savedLang = localStorage.getItem('language');
    if (savedLang) {
        document.cookie = `googtrans=/auto/${savedLang}; path=/`;
        document.cookie = `googtrans=/auto/${savedLang}; domain=${location.hostname}; path=/`;
        setTimeout(() => {
            const combo = document.querySelector('.goog-te-combo');
            if (combo && combo.value !== savedLang) {
                combo.value = savedLang;
                combo.dispatchEvent(new Event('change'));
            }
        }, 1000);
    }
});

function loadAdScript() {}

document.addEventListener('alpine:init', () => {
    Alpine.data('app', () => ({
        activeTab: 'home',
        sidebarOpen: false,
        activeModal: '',
        modalMessage: '',
        notification: { show: false, message: '' },
        confirmResolver: null,
        engineCategories: [],
        dpiValue: 411,
        pointerSpeed: 5,
        dashboardInterval: null,
        localServerRunning: false,
        serverFolderPath: '/storage/emulated/0/Download',
        serverUrl: 'http://localhost:8888',
        showFileBrowser: false,
        browsePath: '/storage/emulated/0',
        dirItems: [],
        browserMode: 'folder',
        customScriptPath: '',

        init() { 
            this.$nextTick(() => this.updateNavIndicator()); 
            this.loadDynamicUI();
            this.checkServerStatus();
            this.startDashboardMonitor();
        },

        checkServerStatus() {
            if (window.Android && window.Android.isLocalServerRunning) {
                this.localServerRunning = window.Android.isLocalServerRunning();
                let ip = window.Android.getLocalIpAddress ? window.Android.getLocalIpAddress() : 'localhost';
                this.serverUrl = `http://${ip}:8888`;
            }
        },

        toggleLocalServer() {
            if (!window.Android) {
                this.showNotification("Feature requires native app environment");
                return;
            }
            if (this.localServerRunning) {
                window.Android.stopLocalServer();
                this.localServerRunning = false;
                this.serverUrl = 'http://localhost:8888';
                this.showNotification("Local Web Server Offline");
            } else {
                if (!this.serverFolderPath || this.serverFolderPath.trim() === '') {
                    this.showNotification("Please specify a valid folder path");
                    return;
                }
                if (window.Android.requestBatteryOptimization) {
                    window.Android.requestBatteryOptimization();
                }
                if (window.Android.startLocalServer(this.serverFolderPath.trim())) {
                    this.localServerRunning = true;
                    let ip = window.Android.getLocalIpAddress ? window.Android.getLocalIpAddress() : 'localhost';
                    this.serverUrl = `http://${ip}:8888`;
                    this.showNotification(`Server Online: ${this.serverUrl}`);
                } else {
                    this.showNotification("Failed to initialize server");
                }
            }
        },

        openBrowser(mode = 'folder') {
            this.browserMode = mode;
            this.showFileBrowser = true;
            this.loadDirectory(this.browsePath || '/storage/emulated/0');
        },

        closeBrowser() {
            this.showFileBrowser = false;
        },

        loadDirectory(path) {
            if (!window.Android || !window.Android.listDirectory) {
                const dummyItems = [
                    { name: "NeonData", isDirectory: true },
                    { name: "Payloads", isDirectory: true },
                    { name: "mock_script.sh", isDirectory: false }
                ];
                this.dirItems = dummyItems;
                this.browsePath = path;
                return;
            }
            try {
                let res = window.Android.listDirectory(path);
                let items = JSON.parse(res);
                if (items.length === 0) {
                    items = [
                        { name: "NeonData", isDirectory: true },
                        { name: "Payloads", isDirectory: true }
                    ];
                }
                items.sort((a, b) => {
                    if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
                    return a.isDirectory ? -1 : 1;
                });
                this.dirItems = items;
                this.browsePath = path;
            } catch(e) {
                this.dirItems = [];
            }
        },

        goUp() {
            let parts = this.browsePath.split('/').filter(Boolean);
            if (parts.length > 0) {
                parts.pop();
                let newPath = '/' + parts.join('/');
                if (newPath === '') newPath = '/';
                this.loadDirectory(newPath);
            }
        },

        enterFolder(folderName) {
            let newPath = this.browsePath.endsWith('/') ? this.browsePath + folderName : this.browsePath + '/' + folderName;
            this.loadDirectory(newPath);
        },

        selectCurrentFolder() {
            this.serverFolderPath = this.browsePath;
            this.showFileBrowser = false;
        },

        selectFile(fileName) {
            if (this.browserMode === 'file') {
                if (!fileName.endsWith('.sh')) {
                    this.showNotification("Please select a .sh script file");
                    return;
                }
                this.customScriptPath = this.browsePath.endsWith('/') ? this.browsePath + fileName : this.browsePath + '/' + fileName;
                this.showFileBrowser = false;
            }
        },

        runCustomScript() {
            if (!window.Android || !window.Android.executeShizukuScript) {
                this.activeModal = '';
                this.showNotification("Script Execution Mocked (Offline)");
                this.customScriptPath = '';
                return;
            }
            window.Android.executeShizukuScript(this.customScriptPath);
            this.activeModal = '';
            this.showNotification("Script Execution Started");
            this.customScriptPath = '';
        },

        async loadDynamicUI() {
            try {
                const res = await fetch('tweaks_ui.json', { cache: "no-store" });
                if(res.ok) {
                    const data = await res.json();
                    this.engineCategories = data.categories || [];
                    this.$nextTick(() => {
                        if(typeof applyStoredTweaks === 'function') applyStoredTweaks();
                        translateUI();
                    });
                }
            } catch(e) {}
        },

        updatePointerSpeed(val) {
            if (typeof saveTweakSetting === 'function') saveTweakSetting('pointer_speed', val);
            const alpine = getAlpine();
            if (alpine) alpine.showNotification('Pointer speed set to ' + val + ' (apply via Exec)');
        },

        async triggerTurboBoost() {
            if (!await this.showConfirm('Turbo Boost applies max performance. Device may get WARM and battery drains faster. Continue?')) return;
            const alpine = getAlpine();
            if (alpine) { alpine.activeModal = 'processing'; alpine.modalMessage = 'TURBO BOOST ACTIVE...'; }
            const boostCmds = [
                COMMANDS.power_mode_performance,
                COMMANDS.animation_speed_fast,
                COMMANDS.touch_boost_on,
                COMMANDS.fps_unlocker_on,
                COMMANDS.force_gpu_rendering,
                COMMANDS.triple_buffering_enable,
                COMMANDS.disable_hw_overlays
            ].filter(Boolean);
            const combined = boostCmds.join(' && ');
            setTimeout(() => {
                if (typeof runTweakFlow === 'function') runTweakFlow(combined, 'Turbo Boost');
                if (alpine) { alpine.activeModal = ''; alpine.showNotification('Turbo Boost Applied!'); }
            }, 1500);
        },

        startDashboardMonitor() {
            if (this.dashboardInterval) return;
            const updateGauge = (id, val, color) => {
                const ring = document.getElementById(id);
                const circumference = 97.4;
                if (ring) ring.style.strokeDashoffset = circumference - (val / 100) * circumference;
            };
            const updateVal = (id, val, suffix = '') => {
                const el = document.getElementById(id);
                if (el) el.textContent = val + suffix;
            };
            const simulateMetrics = () => {
                const cpu = Math.floor(Math.random() * 40 + 10);
                const ram = Math.floor(Math.random() * 30 + 30);
                const temp = Math.floor(Math.random() * 12 + 30);
                const gpu = Math.floor(Math.random() * 35 + 15);
                updateGauge('cpu-gauge-ring', cpu, '#ef4444');
                updateGauge('ram-gauge-ring', ram, '#a855f7');
                updateGauge('gpu-gauge-ring', gpu, '#22c55e');
                updateVal('cpu-gauge-val', cpu);
                updateVal('ram-gauge-val', ram);
                updateVal('gpu-gauge-val', gpu);
                const tempPct = Math.min(100, Math.max(0, ((temp - 25) / 35) * 100));
                updateGauge('temp-gauge-ring', tempPct, temp > 42 ? '#ef4444' : '#facc15');
                updateVal('temp-gauge-val', temp, '');
            };
            if (window.Android && typeof window.Android.getShizukuStatus === 'function') {
                window.Android.getShizukuStatus().then(ok => {
                    if (ok) {
                        this.dashboardInterval = setInterval(() => {
                            if (typeof executeShellCommand === 'function') {
                                executeShellCommand(COMMANDS.diagnose_realtime || 'top -n 1 -b', 'SilentOp', 'dash-' + generateRandomId())
                                    .then(output => {
                                        if (output) {
                                            const lines = output.split('\n');
                                            const cpuLine = lines.find(l => l.includes('CPU'));
                                            if (cpuLine) {
                                                const match = cpuLine.match(/(\d+\.?\d*)%/);
                                                if (match) {
                                                    const cpuVal = Math.min(100, Math.round(parseFloat(match[1])));
                                                    updateGauge('cpu-gauge-ring', cpuVal, '#ef4444');
                                                    updateVal('cpu-gauge-val', cpuVal);
                                                }
                                            }
                                        }
                                    }).catch(() => simulateMetrics());
                            } else {
                                simulateMetrics();
                            }
                        }, 3000);
                        return;
                    }
                    this.dashboardInterval = setInterval(simulateMetrics, 3000);
                });
            } else {
                this.dashboardInterval = setInterval(simulateMetrics, 3000);
            }
        },

        handleDynamicSwitch(item, isChecked) {
            const commandKey = isChecked ? item.cmdOn : item.cmdOff;
            const command = isChecked ? COMMANDS[commandKey] : RESTORE_COMMANDS[commandKey];
            const moduleName = isChecked ? item.msgOn : item.msgOff;
            if (command) {
                if(typeof saveTweakSetting === 'function') saveTweakSetting(item.id || item.tweak, isChecked);
                if(typeof runTweakFlow === 'function') runTweakFlow(command, moduleName);
            } else {
                this.showNotification("Mock logic applied: Command missing from JSON");
            }
        },

        setActiveTab(tab, event) {
            const oldTab = this.activeTab;
            if (oldTab === tab) return;
            this.activeTab = tab;
            
            if (event && event.currentTarget) {
                this.updateNavIndicator(event.currentTarget);
            } else {
                this.updateNavIndicator();
            }

            try {
                if (oldTab === 'network' && typeof stopPingUpdates === 'function') stopPingUpdates();
                if (tab === 'network' && typeof startPingUpdates === 'function') setTimeout(() => startPingUpdates(), 500);
            } catch (e) {}
        },

        updateNavIndicator(target) {
            const nav = this.$refs.nav;
            if (!nav) return;
            const activeTarget = target || nav.querySelector('.nav-item.active');
            if (activeTarget) {
                nav.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
                activeTarget.classList.add('active');
            }
        },

        showConfirm(message) {
            this.modalMessage = message; 
            this.activeModal = 'confirm';
            return new Promise(resolve => { this.confirmResolver = resolve; });
        },

        resolveConfirm(value) { 
            this.confirmResolver?.(value); 
            this.activeModal = ''; 
        },

        showNotification(message, duration = 3000) {
            this.notification.message = message; 
            this.notification.show = true;
            setTimeout(() => { this.notification.show = false; }, duration);
        },

        async disableDns() {
            this.modalMessage = 'Executing Override...'; 
            this.activeModal = 'processing';
            try {
                if (COMMANDS && COMMANDS.disable_dns) {
                    await executeShellCommand(COMMANDS.disable_dns, 'SilentOp', `dns-disable-${generateRandomId()}`);
                    this.activeModal = ''; 
                    this.showNotification('DNS override applied successfully.');
                } else {
                    throw new Error("DNS CMD missing");
                }
            } catch (e) {
                this.activeModal = 'dnsWarning'; 
                this.showNotification('DNS update failed.');
            }
        }
    }));
});

function getAlpine() { 
    if (document.body._x_dataStack && document.body._x_dataStack.length > 0) {
        return document.body._x_dataStack[0];
    }
    return {
        activeModal: '',
        modalMessage: '',
        showNotification: () => {},
        showConfirm: async () => false
    };
}

function generateRandomId() { return Array.from({ length: 15 }, () => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ01223456789'.charAt(Math.floor(Math.random() * 62))).join(''); }

function parseAnsiColors(text) {
    if (!text) return '';
    const ansiMap = { '\x1B[0;31m': '<span class="text-red-500">', '\x1B[0;32m': '<span class="text-green-500">', '\x1B[0;36m': '<span class="text-cyan-500">', '\x1B[1;33m': '<span class="text-yellow-500">', '\x1B[0m': '</span>' };
    let html = text.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
    return Object.entries(ansiMap).reduce((acc, [ansi, tag]) => acc.replace(new RegExp(ansi.replace(/\[/g, '\\['), 'g'), tag), html);
}

async function loadData(key, url, elementId) {
    try {
        let data = JSON.parse(localStorage.getItem(key));
        if (!data) {
            const response = await fetch(url, { cache: "no-store" });
            if (!response.ok) throw new Error(`HTTP error! ${response.status}`);
            data = await response.json(); localStorage.setItem(key, JSON.stringify(data));
        } 
        return data;
    } catch (error) {
        return null;
    }
}
