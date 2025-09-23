const LANG_URL = "lang.json";
const VERSION_URL = "version.json";
const COMMANDS_URL = "commands.json";
const RESTORE_URL = "restore.json";
const FPS_MODULES_URL = "https://raw.githubusercontent.com/AgungDevlop/Viral/refs/heads/main/FpsSetting.json";
const FAKE_DEVICE_URL = "https://raw.githubusercontent.com/AgungDevlop/Viral/main/FakeDevice.json";
const GAME_JSON_URL = "game.json";
const PERFORMANCE_JSON_URL = "performance.json";

let LANGUAGES = {};
let currentLanguage = localStorage.getItem('language') || 'id';

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
    LANGUAGES = await loadData("cachedLanguages", LANG_URL);
    if (LANGUAGES) {
        translateUI();
    }
}

function getLangString(key, replacements = {}) {
    let str = LANGUAGES[currentLanguage]?.[key] || key;
    for (const placeholder in replacements) {
        str = str.replace(`{${placeholder}}`, replacements[placeholder]);
    }
    return str;
}

function translateUI() {
    document.querySelectorAll('[data-lang-key]').forEach(el => {
        const key = el.getAttribute('data-lang-key');
        el.innerHTML = getLangString(key);
    });
    document.querySelectorAll('[data-lang-key-placeholder]').forEach(el => {
        const key = el.getAttribute('data-lang-key-placeholder');
        el.placeholder = getLangString(key);
    });
}

function setLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('language', lang);
    translateUI();
    getAlpine().activeModal = '';
}

function loadAdScript() {
    if (document.querySelector('script[data-zone="9797539"]')) { return; }
    try {
        const s = document.createElement('script');
        s.dataset.zone = 9797539;
        s.src = 'https://ptichoolsougn.net/vignette.min.js';
        const target = [document.documentElement, document.body].filter(Boolean).pop();
        target.appendChild(s);
    } catch (e) { console.error("Failed to inject ad script:", e); }
}

document.addEventListener('alpine:init', () => {
    Alpine.data('app', () => ({
        activeTab: 'home',
        sidebarOpen: false,
        activeModal: '',
        modalMessage: '',
        notification: { show: false, message: '' },
        confirmResolver: null,

        init() { this.$nextTick(() => this.updateNavIndicator()); },

        setActiveTab(tab, event) {
            const oldTab = this.activeTab;
            if (oldTab === tab) return;
            this.activeTab = tab;
            this.updateNavIndicator(event.currentTarget);
            if (oldTab === 'tweaks') stopDiagnosis();
            if (oldTab === 'network') stopPingUpdates();
            if (tab === 'tweaks') setTimeout(() => startDiagnosis(), 500);
            if (tab === 'network') setTimeout(() => startPingUpdates(), 500);
        },

        updateNavIndicator(target) {
            if (!target) target = this.$refs.nav.querySelector('.nav-item.active');
            if (target) {
                document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
                target.classList.add('active');
            }
        },

        showConfirm(message) {
            this.modalMessage = message; this.activeModal = 'confirm';
            return new Promise(resolve => { this.confirmResolver = resolve; });
        },

        resolveConfirm(value) { this.confirmResolver?.(value); this.activeModal = ''; },

        showNotification(message, duration = 3000) {
            this.notification.message = message; this.notification.show = true;
            setTimeout(() => { this.notification.show = false; }, duration);
        },

        async disableDns() {
            this.modalMessage = getLangString('modal_processing_title'); this.activeModal = 'processing';
            try {
                await executeShellCommand(COMMANDS.disable_dns, 'SilentOp', `dns-disable-${generateRandomId()}`);
                this.activeModal = ''; this.showNotification('Adblock DNS has been disabled successfully.'); loadAdScript();
            } catch (e) {
                console.error("Failed to disable DNS:", e); this.activeModal = 'dnsWarning'; this.showNotification('Failed to disable DNS. Please try again.');
            }
        }
    }));
});

function getAlpine() { return document.body._x_dataStack[0]; }
function generateRandomId() { return Array.from({ length: 15 }, () => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ01223456789'.charAt(Math.floor(Math.random() * 62))).join(''); }
function parseAnsiColors(text) {
    if (!text) return '';
    const ansiMap = { '\x1B[0;31m': '<span class="ansi-red">', '\x1B[0;32m': '<span class="ansi-green">', '\x1B[0;36m': '<span class="ansi-cyan">', '\x1B[1;33m': '<span class="ansi-yellow">', '\x1B[0m': '</span>' };
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
        } return data;
    } catch (error) {
        console.error(`Error loading from ${url}:`, error);
        if (elementId) document.getElementById(elementId).innerHTML = `<p class="text-red-400 text-sm"><i class="fas fa-exclamation-circle mr-2"></i>Failed to load. Check connection.</p>`;
        return null;
    }
}