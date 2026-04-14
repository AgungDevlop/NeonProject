async function initializeAppFeatures() {
    await checkDnsStatus(); 
    await initializeDashboard(); 
}

const checkStatusAndInit = async () => {
    if (window.Android && typeof window.Android.getShizukuStatus === 'function') {
        const shizukuOk = await window.Android.getShizukuStatus();
        if (shizukuOk) {
            getAlpine().activeModal = '';
            await initializeAppFeatures();
        } else {
            getAlpine().activeModal = 'shizukuRequired';
        }
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
        if (typeof initializeDiagnosisChart === 'function') initializeDiagnosisChart(); 
        if (typeof initializeBuilder === 'function') initializeBuilder();
    } catch (error) { 
        getAlpine().showNotification("App failed to initialize properly."); 
    }
    setupEventListeners();
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
        const dpiInput = document.getElementById("dpi-input");
        if (!dpiInput) return;
        const dpi = dpiInput.value; 
        if (!dpi) return; 
        if(typeof saveTweakSetting === 'function') saveTweakSetting('dpi', dpi); 
        if(typeof runTweakFlow === 'function') runTweakFlow(COMMANDS.set_dpi.replace('{value}', dpi), getLangString('tweaks_dpi_label')); 
    });
    
    document.getElementById("reset-dpi-btn")?.addEventListener("click", () => { 
        if(typeof saveTweakSetting === 'function') saveTweakSetting('dpi', ''); 
        const dpiInput = document.getElementById("dpi-input");
        if (dpiInput) dpiInput.value = ''; 
        if(typeof runTweakFlow === 'function') runTweakFlow(COMMANDS.reset_dpi, getLangString('tweaks_dpi_label')); 
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
    let isCheckingStatus = false;

    if (window.Android && typeof window.Android.startAdbPairingFlow === 'function') {
        if (uiNativeAdb) uiNativeAdb.style.display = 'flex';
        if (uiLegacyShizuku) uiLegacyShizuku.style.display = 'none';

        // Tidak memakai clearInterval, biarkan pulse check tetap ada untuk reliability
        setInterval(async () => {
            const alpine = typeof getAlpine === 'function' ? getAlpine() : (document.querySelector('[x-data]') ? document.querySelector('[x-data]').__x.$data : null);
            
            if (!alpine) return;

            // Hanya lakukan ping status jika pengguna memang sedang berada di hadapan modal pairing
            if (alpine.activeModal === 'shizukuRequired') {
                if (isCheckingStatus) return;
                isCheckingStatus = true;
                
                try {
                    const isConnected = await window.Android.getShizukuStatus();
                    if (isConnected) {
                        alpine.activeModal = ''; // Auto Close!
                        alpine.showNotification("Engine Terhubung Otomatis!");
                        
                        if (typeof initializeAppFeatures === 'function') {
                            await initializeAppFeatures();
                        }
                    }
                } catch (e) {
                    console.error("Error:", e);
                } finally {
                    isCheckingStatus = false;
                }
            }
        }, 2000);
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
