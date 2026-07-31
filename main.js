let isInitializingAppFeatures = false;
async function initializeAppFeatures() {
    if (isInitializingAppFeatures) return;
    isInitializingAppFeatures = true;
    try {
        // Force-reset status cache on every feature init so getCachedShizukuStatus()
        // always does a fresh Java call instead of returning stale 'false'.
        if (typeof _lastStatusCheck !== 'undefined') _lastStatusCheck = 0;
        await checkDnsStatus();
        await initializeDashboard();
    } finally {
        isInitializingAppFeatures = false;
    }
}

/**
 * Called by Java (from NeonCoreUIWebInterface.notifyEngineReady) when DAEMON_READY fires.
 * This is the authoritative "engine is connected" signal from the Java side.
 * Resets status cache and triggers full dashboard initialization.
 */
window.notifyEngineReady = async function() {
    // Reset cache — force fresh getShizukuStatus() call on next check
    if (typeof _lastStatusCheck !== 'undefined') _lastStatusCheck = 0;
    if (typeof _cachedStatus !== 'undefined') _cachedStatus = false;

    const alpine = typeof getAlpine === 'function' ? getAlpine() : null;
    if (alpine) {
        if (alpine.activeModal === 'shizukuRequired' || alpine.activeModal === '') {
            alpine.activeModal = '';
            alpine.showNotification('Engine Terhubung!');
        }
    }
    // Stop the ADB polling loop since we're now connected
    if (window._adbPollInterval) {
        clearInterval(window._adbPollInterval);
        window._adbPollInterval = null;
    }
    await initializeAppFeatures();
};

// isCheckingStatus prevents concurrent calls from DOMContentLoaded AND visibilitychange
let isCheckingStatus = false;
const checkStatusAndInit = async () => {
    if (isCheckingStatus) return;
    isCheckingStatus = true;
    try {
        if (window.Android && typeof window.Android.getShizukuStatus === 'function') {
            const shizukuOk = await window.Android.getShizukuStatus();
            if (shizukuOk) {
                const alpine = getAlpine();
                if (alpine) alpine.activeModal = '';
                await initializeAppFeatures();
            } else {
                const alpine = getAlpine();
                if (alpine) alpine.activeModal = 'shizukuRequired';
            }
        }
    } finally {
        isCheckingStatus = false;
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await checkStatusAndInit();
        await loadLanguages();
        await loadCommands(); 
        if (typeof loadTweakSettings === 'function') loadTweakSettings();
        
        await Promise.all([
            loadFpsModules(), 
            loadFakeDevices(), 
            loadGames(),
            loadPerformanceCommands(), 
            checkForUpdates()
        ]);
        
        if (typeof renderLogs === 'function') renderLogs(); 
        if (typeof renderTweakComponents === 'function') renderTweakComponents(); 
        if (typeof initializeNetworkTab === 'function') initializeNetworkTab();
        if (typeof initializeBuilder === 'function') initializeBuilder();
    } catch (error) { 
        getAlpine().showNotification("App failed to initialize properly."); 
    }
    setupEventListeners();
});

document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
        // Re-check ADB status on app resume.
        // isCheckingStatus guard in checkStatusAndInit prevents concurrent execution.
        try {
            await checkStatusAndInit();
        } catch (e) {
            console.error("Error on resume:", e);
        }
    }
});

function setupEventListeners() {
    const setupTweakRadioListener = (containerId, name) => { 
        const container = document.getElementById(containerId);
        if (container) {
            container.addEventListener('change', e => { 
                if (e.target.type !== 'radio') return; 
                const value = e.target.value; 
                const command = value.startsWith("restore") ? RESTORE_COMMANDS[value] : COMMANDS[value];
                if (command) {
                    if(typeof saveTweakSetting === 'function') saveTweakSetting(name, value); 
                    if(typeof runTweakFlow === 'function') runTweakFlow(command, e.target.nextElementSibling.textContent.trim()); 
                }
            });
        }
    };

    document.getElementById("translate-btn-icon")?.addEventListener("click", () => getAlpine().activeModal = 'translate');
    document.getElementById("settings-btn-icon")?.addEventListener("click", () => getAlpine().activeModal = 'custom');
    document.getElementById("lang-id-btn")?.addEventListener("click", () => { if(typeof setLanguage === 'function') setLanguage('id'); });
    document.getElementById("lang-en-btn")?.addEventListener("click", () => { if(typeof setLanguage === 'function') setLanguage('en'); });

    setupTweakRadioListener('renderer-options', 'renderer');
    setupTweakRadioListener('network-profile-options', 'network_profile');
    setupTweakRadioListener('dns-options-container', 'dns');

    document.getElementById("apply-jit-speed-btn")?.addEventListener("click", () => {
        if (COMMANDS && COMMANDS.jit_speed_profile && typeof runCommandFlow === 'function') {
            runCommandFlow(COMMANDS.jit_speed_profile, getLangString('perf_jit_speed'));
        }
    });

    const applyPerAppTweak = (commandKey, moduleName) => {
        const pkgInput = document.getElementById("package-name-input");
        if (!pkgInput) return;
        const packageName = pkgInput.value.trim();
        if (!packageName) { getAlpine().showNotification(getLangString("notification_pkg_name_empty")); return; }
        const commandTemplate = COMMANDS[commandKey];
        if (commandTemplate && typeof runCommandFlow === 'function') {
            const finalCommand = commandTemplate.replace(/{packageName}/g, packageName);
            runCommandFlow(finalCommand, `${moduleName} for ${packageName}`);
        }
    };

    document.getElementById("apply-angle-btn")?.addEventListener("click", () => applyPerAppTweak('force_angle_for_app', getLangString('tweaks_angle')));
    document.getElementById("apply-updatable-driver-btn")?.addEventListener("click", () => applyPerAppTweak('force_updatable_driver_for_app', getLangString('tweaks_updatable_driver')));

    document.getElementById("set-dpi-btn")?.addEventListener("click", () => { 
        const dpiSlider = document.getElementById("dpi-slider");
        if (!dpiSlider) return;
        const dpi = dpiSlider.value; 
        if (!dpi || dpi < 240 || dpi > 600) { getAlpine().showNotification("DPI out of safe range (240-600)"); return; }
        if(typeof saveTweakSetting === 'function') saveTweakSetting('dpi', dpi); 
        if(typeof runTweakFlow === 'function') runTweakFlow(COMMANDS.set_dpi.replace('{value}', dpi), getLangString('tweaks_dpi_label')); 
    });
    
    document.getElementById("reset-dpi-btn")?.addEventListener("click", () => { 
        if(typeof saveTweakSetting === 'function') saveTweakSetting('dpi', ''); 
        if(typeof runTweakFlow === 'function') runTweakFlow(COMMANDS.reset_dpi, getLangString('tweaks_dpi_label')); 
        const dpiSlider = document.getElementById("dpi-slider");
        const dpiLabel = document.getElementById("dpi-value-label");
        if (dpiSlider) { dpiSlider.value = 411; dpiSlider.dispatchEvent(new Event('input')); }
        if (dpiLabel) dpiLabel.textContent = '411';
    });

    const setupUtilityButton = (btnId, commandKey, langKey) => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.addEventListener("click", () => {
                const command = (typeof PERFORMANCE_COMMANDS !== 'undefined' && PERFORMANCE_COMMANDS[commandKey]) || (typeof COMMANDS !== 'undefined' && COMMANDS[commandKey]);
                if (command && typeof runCommandFlow === 'function') { 
                    runCommandFlow(command, getLangString(langKey)); 
                } else { 
                    getAlpine().showNotification("Utility command not found."); 
                }
            });
        }
    };
    
    setupUtilityButton('ram-cleaner-btn', 'utilityRamClean', 'tweaks_ram_cleaner');
    setupUtilityButton('clear-cache-btn', 'utilityStorageClean', 'tweaks_cache_clean');
    setupUtilityButton('deep-sleep-btn', 'force_deep_sleep', 'tweaks_deep_sleep');
    setupUtilityButton('log-cleaner-btn', 'log_cleaner', 'tweaks_log_cleaner');
    setupUtilityButton('fstrim-btn', 'fstrim_command', 'tweaks_fstrim');
    setupUtilityButton('dex-compile-btn', 'force_dex_compile', 'tweaks_dex_compile');

    document.getElementById("apply-pointer-btn")?.addEventListener("click", () => {
        const slider = document.getElementById("pointer-speed-slider");
        if (!slider) return;
        const val = slider.value;
        if (typeof saveTweakSetting === 'function') saveTweakSetting('pointer_speed', val);
        if (typeof runTweakFlow === 'function') {
            const cmd = COMMANDS.pointer_speed_fast.replace(/(pointer_speed) \d/, '$1 ' + val);
            runTweakFlow(cmd, 'Pointer Speed ' + val);
        }
    });

    document.getElementById("profile-gaming-btn")?.addEventListener("click", () => {
        const cmds = [
            COMMANDS.power_mode_performance,
            COMMANDS.animation_speed_fast,
            COMMANDS.touch_boost_on,
            COMMANDS.fps_unlocker_on,
            COMMANDS.force_gpu_rendering,
            COMMANDS.triple_buffering_enable,
            COMMANDS.disable_hw_overlays,
            COMMANDS.game_mode_on,
            COMMANDS.high_touch_sens_on,
            COMMANDS.gaming_dnd_on
        ].filter(Boolean);
        if (typeof runTweakFlow === 'function') runTweakFlow(cmds.join(' && '), 'Gaming Profile');
    });

    document.getElementById("profile-balanced-btn")?.addEventListener("click", () => {
        const cmds = [
            COMMANDS.animation_speed_fast,
            COMMANDS.disable_ui_blurs_on,
            COMMANDS.background_limiter_on,
            COMMANDS.force_gpu_rendering,
            COMMANDS.high_touch_sens_on,
            COMMANDS.scroll_friction_fast
        ].filter(Boolean);
        if (typeof runTweakFlow === 'function') runTweakFlow(cmds.join(' && '), 'Balanced Profile');
    });

    document.getElementById("profile-stock-btn")?.addEventListener("click", async () => {
        if (await getAlpine().showConfirm("Restore all settings to stock? This resets all tweaks.")) {
            if (typeof runTweakFlow === 'function' && typeof RESTORE_COMMANDS !== 'undefined') {
                runTweakFlow(Object.values(RESTORE_COMMANDS).join(' && '), 'Restore Stock');
            }
            localStorage.removeItem('tweakSettings');
            setTimeout(() => location.reload(), 2500);
        }
    });

    document.getElementById("restore-tweaks-btn")?.addEventListener("click", async () => { 
        if (await getAlpine().showConfirm(getLangString("notification_confirm_restore_tweaks"))) { 
            if(typeof runTweakFlow === 'function' && typeof RESTORE_COMMANDS !== 'undefined') {
                runTweakFlow(Object.values(RESTORE_COMMANDS).join(' && '), getLangString("tweaks_restore_all_btn")); 
            }
            localStorage.removeItem('tweakSettings'); 
            setTimeout(() => location.reload(), 2500); 
        } 
    });

    document.getElementById("custom-module-btn")?.addEventListener("click", (e) => { 
        if (e.currentTarget.textContent === getLangString('custom_module_select_btn')) {
            document.getElementById("custom-module-input")?.click(); 
        } else if(typeof handleCustomModule === 'function') {
            handleCustomModule(); 
        }
    });
    
    document.getElementById("custom-module-input")?.addEventListener("change", (e) => { 
        const btn = document.getElementById("custom-module-btn"); 
        if (e.target.files.length && e.target.files[0].name.endsWith('.sh') && btn) { 
            btn.textContent = getLangString('custom_command_run_btn'); 
            btn.className = "btn bg-purple-600 text-white hover:bg-purple-500"; 
        } 
    });

    document.getElementById("run-custom-command-btn")?.addEventListener("click", () => { if(typeof handleCustomCommand === 'function') handleCustomCommand(); });
    document.getElementById("clear-logs-btn-custom")?.addEventListener("click", () => { if(typeof clearAllLogs === 'function') clearAllLogs(); });

    document.getElementById("restore-device-btn")?.addEventListener("click", () => { 
        if(typeof allFakeDevices !== 'undefined') {
            const module = allFakeDevices.find(d => d.name === "Restore Device"); 
            if(module && typeof handleRestore === 'function') handleRestore(module.name, module.url, typeof activeFakeDevices !== 'undefined' ? activeFakeDevices : null, "activeFakeDevices", typeof renderFakeDevices === 'function' ? renderFakeDevices : null, allFakeDevices); 
        }
    });

    document.getElementById("restore-fps-btn")?.addEventListener("click", () => { 
        if(typeof allFpsModules !== 'undefined') {
            const module = allFpsModules.find(m => m.name === "Stop Module"); 
            if(module && typeof handleRestore === 'function') handleRestore(module.name, module.url, typeof activeModules !== 'undefined' ? activeModules : null, "activeModules", typeof renderFpsModules === 'function' ? renderFpsModules : null, allFpsModules); 
        }
    });
    
    document.getElementById("scan-games-btn")?.addEventListener("click", () => { if(typeof scanInstalledGames === 'function') scanInstalledGames(); });
    document.getElementById("restore-game-settings-btn")?.addEventListener("click", () => { if(typeof restoreGameSettings === 'function') restoreGameSettings(); });

    const uiNativeAdb = document.getElementById('ui-native-adb');
    const uiLegacyShizuku = document.getElementById('ui-legacy-shizuku');
    // NOTE: do NOT declare a local isCheckingStatus here — the module-level one in
    // checkStatusAndInit already guards concurrent calls to getShizukuStatus().

    if (window.Android && typeof window.Android.startAdbPairingFlow === 'function') {
        if (uiNativeAdb) uiNativeAdb.style.display = 'flex';
        if (uiLegacyShizuku) uiLegacyShizuku.style.display = 'none';

        let engineConnected = false; // Stop polling once we know we're connected

        // Store ID so we can clear it if setupEventListeners is called again (prevents duplicate loops)
        if (window._adbPollInterval) clearInterval(window._adbPollInterval);
        window._adbPollInterval = setInterval(async () => {
            // Once connected, never poll again
            if (engineConnected) return;

            const alpine = typeof getAlpine === 'function' ? getAlpine() : null;
            if (!alpine) return;

            // Only poll while the "connect" modal is open
            if (alpine.activeModal !== 'shizukuRequired') return;

            try {
                // Use getCachedShizukuStatus to avoid hammering DaemonServer
                const isConnected = typeof getCachedShizukuStatus === 'function'
                    ? await getCachedShizukuStatus()
                    : await window.Android.getShizukuStatus();
                if (isConnected) {
                    engineConnected = true;
                    clearInterval(window._adbPollInterval);
                    window._adbPollInterval = null;
                    alpine.activeModal = '';
                    alpine.showNotification("Engine Terhubung Otomatis!");
                    if (typeof initializeAppFeatures === 'function') {
                        await initializeAppFeatures();
                    }
                }
            } catch (e) {
                // Silently ignore — daemon may still be starting up
            }
        }, 3000);
    } else {
        if (uiNativeAdb) uiNativeAdb.style.display = 'none';
        if (uiLegacyShizuku) uiLegacyShizuku.style.display = 'flex';
    }




    document.getElementById('adb-pair-btn')?.addEventListener('click', () => {
        if (window.Android && typeof window.Android.startAdbPairingFlow === 'function') {
            window.Android.startAdbPairingFlow();
        }
    });

    document.getElementById('adb-tutorial-btn')?.addEventListener('click', () => {
        const tutorialUrl = 'https://vt.tiktok.com/ZSHpGtANm/'; 
        if (window.Android && typeof window.Android.openInChrome === 'function') {
            window.Android.openInChrome(tutorialUrl);
        } else {
            window.open(tutorialUrl, '_blank');
        }
    });

    document.getElementById('shizuku-open-btn')?.addEventListener('click', () => {
        if (window.Android && typeof window.Android.openInChrome === 'function') {
            window.Android.openInChrome('https://play.google.com/store/apps/details?id=moe.shizuku.privileged.api');
        } else {
            window.open('https://play.google.com/store/apps/details?id=moe.shizuku.privileged.api', '_blank');
        }
    });

    document.getElementById('shizuku-recheck-btn')?.addEventListener('click', async () => {
        const btn = document.getElementById('shizuku-recheck-btn');
        if (!btn) return;
        const originalHtml = btn.innerHTML;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>CHECKING...`;
        btn.disabled = true;

        let isOk = false;
        if (window.Android && typeof window.Android.getShizukuStatus === 'function') {
            isOk = await window.Android.getShizukuStatus();
        }

        const alpine = typeof getAlpine === 'function' ? getAlpine() : (document.querySelector('[x-data]') ? document.querySelector('[x-data]').__x.$data : null);

        if (isOk) {
            if (alpine) {
                alpine.activeModal = '';
                alpine.showNotification("Terminal Terhubung!");
            }
            if (typeof initializeAppFeatures === 'function') {
                await initializeAppFeatures();
            }
        } else {
            if (alpine) alpine.showNotification("Terminal masih offline / Proses injeksi...");
        }

        btn.innerHTML = originalHtml;
        btn.disabled = false;
    });

    document.getElementById('shizuku-later-btn')?.addEventListener('click', () => {
        if (window.pendingUpdate) {
            getAlpine().activeModal = 'update';
            window.pendingUpdate = false;
        } else {
            getAlpine().activeModal = '';
        }
    });
}
