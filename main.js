async function initializeAppFeatures() {
    await checkDnsStatus(); 
    await initializeDashboard(); 
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
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

        const shizukuOk = await checkShizukuStatus();
        if (shizukuOk) { 
            await initializeAppFeatures();
        } else {
            getAlpine().activeModal = 'shizukuRequired';
        }
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
                    runTweakFlow(command, e.target.nextElementSibling.textContent.trim()); 
                }
            });
        }
    };

    document.getElementById("translate-btn-icon")?.addEventListener("click", () => getAlpine().activeModal = 'translate');
    document.getElementById("settings-btn-icon")?.addEventListener("click", () => getAlpine().activeModal = 'custom');
    document.getElementById("lang-id-btn")?.addEventListener("click", () => setLanguage('id'));
    document.getElementById("lang-en-btn")?.addEventListener("click", () => setLanguage('en'));

    setupTweakRadioListener('renderer-options', 'renderer');
    setupTweakRadioListener('network-profile-options', 'network_profile');
    setupTweakRadioListener('dns-options-container', 'dns');

    document.getElementById("apply-jit-speed-btn")?.addEventListener("click", () => {
        if (COMMANDS.jit_speed_profile) {
            runCommandFlow(COMMANDS.jit_speed_profile, getLangString('perf_jit_speed'));
        }
    });

    const applyPerAppTweak = (commandKey, moduleName) => {
        const pkgInput = document.getElementById("package-name-input");
        const packageName = pkgInput.value.trim();
        if (!packageName) { getAlpine().showNotification(getLangString("notification_pkg_name_empty")); return; }
        const commandTemplate = COMMANDS[commandKey];
        if (commandTemplate) {
            const finalCommand = commandTemplate.replace(/{packageName}/g, packageName);
            runCommandFlow(finalCommand, `${moduleName} for ${packageName}`);
        }
    };

    document.getElementById("apply-angle-btn")?.addEventListener("click", () => applyPerAppTweak('force_angle_for_app', getLangString('tweaks_angle')));
    document.getElementById("apply-updatable-driver-btn")?.addEventListener("click", () => applyPerAppTweak('force_updatable_driver_for_app', getLangString('tweaks_updatable_driver')));

    document.getElementById("set-dpi-btn")?.addEventListener("click", () => { 
        const dpi = document.getElementById("dpi-input").value; 
        if (!dpi) return; 
        if(typeof saveTweakSetting === 'function') saveTweakSetting('dpi', dpi); 
        runTweakFlow(COMMANDS.set_dpi.replace('{value}', dpi), getLangString('tweaks_dpi_label')); 
    });
    document.getElementById("reset-dpi-btn")?.addEventListener("click", () => { 
        if(typeof saveTweakSetting === 'function') saveTweakSetting('dpi', ''); 
        document.getElementById('dpi-input').value = ''; 
        runTweakFlow(COMMANDS.reset_dpi, getLangString('tweaks_dpi_label')); 
    });

    const setupUtilityButton = (btnId, commandKey, langKey) => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.addEventListener("click", () => {
                const command = PERFORMANCE_COMMANDS[commandKey] || COMMANDS[commandKey];
                if (command) { runCommandFlow(command, getLangString(langKey)); } 
                else { getAlpine().showNotification("Utility command not found."); }
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
            runTweakFlow(Object.values(RESTORE_COMMANDS).join(' && '), getLangString("tweaks_restore_all_btn")); 
            localStorage.removeItem('tweakSettings'); 
            setTimeout(() => location.reload(), 2500); 
        } 
    });

    document.getElementById("custom-module-btn")?.addEventListener("click", (e) => { 
        if (e.currentTarget.textContent === getLangString('custom_module_select_btn')) document.getElementById("custom-module-input").click(); 
        else if(typeof handleCustomModule === 'function') handleCustomModule(); 
    });
    document.getElementById("custom-module-input")?.addEventListener("change", (e) => { 
        const btn = document.getElementById("custom-module-btn"); 
        if (e.target.files.length && e.target.files[0].name.endsWith('.sh')) { 
            btn.textContent = getLangString('custom_command_run_btn'); btn.className = "btn bg-purple-600 text-white hover:bg-purple-500"; 
        } 
    });
    document.getElementById("run-custom-command-btn")?.addEventListener("click", () => { if(typeof handleCustomCommand === 'function') handleCustomCommand(); });
    document.getElementById("clear-logs-btn-custom")?.addEventListener("click", () => { if(typeof clearAllLogs === 'function') clearAllLogs(); });

    document.getElementById("restore-device-btn")?.addEventListener("click", () => { 
        const module = allFakeDevices.find(d => d.name === "Restore Device"); 
        if(module && typeof handleRestore === 'function') handleRestore(module.name, module.url, activeFakeDevices, "activeFakeDevices", renderFakeDevices, allFakeDevices); 
    });
    document.getElementById("restore-fps-btn")?.addEventListener("click", () => { 
        const module = allFpsModules.find(m => m.name === "Stop Module"); 
        if(module && typeof handleRestore === 'function') handleRestore(module.name, module.url, activeModules, "activeModules", renderFpsModules, allFpsModules); 
    });
    
    document.getElementById("scan-games-btn")?.addEventListener("click", () => { if(typeof scanInstalledGames === 'function') scanInstalledGames(); });
    document.getElementById("restore-game-settings-btn")?.addEventListener("click", () => { if(typeof restoreGameSettings === 'function') restoreGameSettings(); });

    document.getElementById('shizuku-tutorial-btn')?.addEventListener('click', () => { window.open('https://vt.tiktok.com/ZSH4eTxc5/', '_blank'); });
    
    document.getElementById('shizuku-recheck-btn')?.addEventListener('click', async () => {
        const btn = document.getElementById('shizuku-recheck-btn');
        btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>Checking...`; 
        btn.disabled = true;
        const shizukuOkNow = await checkShizukuStatus();
        if (shizukuOkNow) {
            getAlpine().activeModal = window.pendingUpdate ? 'update' : ''; 
            window.pendingUpdate = false;
            getAlpine().showNotification(getLangString('notification_shizuku_connected'));
            await initializeAppFeatures();
        } else {
            getAlpine().showNotification(getLangString('notification_shizuku_still_not_running'));
            btn.innerHTML = `<i class="fas fa-sync-alt mr-2"></i><span data-lang-key="modal_shizuku_recheck_btn"></span>`;
            translateUI();
            btn.disabled = false;
            
            if (window.Android && window.Android.openInChrome) {
                window.Android.openInChrome('https://play.google.com/store/apps/details?id=com.iadb.helper');
            } else {
                window.open('https://play.google.com/store/apps/details?id=com.iadb.helper', '_blank');
            }
        }
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
