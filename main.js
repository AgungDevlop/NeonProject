async function initializeAppFeatures() {
    await checkDnsStatus(); 
    await initializeDashboard(); 
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadLanguages();
        await loadCommands(); 
        loadTweakSettings();
        await Promise.all([
            loadFpsModules(), 
            loadFakeDevices(), 
            loadGames(),
            loadPerformanceCommands(), 
            checkForUpdates()
        ]);
        
        renderLogs(); 
        renderTweakComponents(); 
        initializeNetworkTab();
        initializeDiagnosisChart(); 
        applyStoredTweaks();

        const shizukuOk = await checkShizukuStatus();
        if (shizukuOk) { 
            await initializeAppFeatures();
        } else {
            getAlpine().activeModal = 'shizukuRequired';
        }
    } catch (error) { 
        console.error("Initialization failed:", error); 
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
                    saveTweakSetting(name, value); 
                    runTweakFlow(command, e.target.nextElementSibling.textContent.trim()); 
                }
            });
        }
    };

    const setupTweakSwitchListener = (switchId, tweakKey, commandOn, commandOff, moduleNameOn, moduleNameOff) => { 
        const switchEl = document.getElementById(switchId);
        if (switchEl) {
            switchEl.addEventListener('change', e => { 
                const isChecked = e.target.checked;
                const commandKey = isChecked ? commandOn : commandOff;
                const command = isChecked ? COMMANDS[commandKey] : RESTORE_COMMANDS[commandKey];
                const moduleName = isChecked ? moduleNameOn : moduleNameOff;
                if (command) {
                    saveTweakSetting(tweakKey, isChecked); 
                    runTweakFlow(command, moduleName);
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

    setupTweakSwitchListener('power-mode-switch', 'power_mode', 'power_mode_performance', 'restore_power_mode', 'Enabling Performance Mode', 'Restoring Power Mode');
    setupTweakSwitchListener('doze-mode-switch', 'doze_mode', 'disable_doze', 'restore_doze', 'Disabling Doze Mode', 'Restoring Doze Mode');
    setupTweakSwitchListener('game-mode-switch', 'game_mode', 'game_mode_on', 'restore_game_mode', 'Enabling Game Mode', 'Disabling Game Mode');
    setupTweakSwitchListener('gputuner-switch', 'gputuner_switch', 'enable_gputuner', 'restore_gputuner', 'Enabling GPU Tuner', 'Disabling GPU Tuner');
    setupTweakSwitchListener('fps-unlocker-switch', 'fps_unlocker', 'fps_unlocker_on', 'restore_fps_unlocker', 'Unlocking FPS', 'Restoring FPS');
    setupTweakSwitchListener('gpu-rendering-switch', 'gpu_rendering', 'force_gpu_rendering', 'restore_gpu_rendering', 'Forcing GPU Render', 'Restoring GPU Render');
    setupTweakSwitchListener('animation-speed-switch', 'animation_speed', 'animation_speed_fast', 'restore_animation_speed', 'Faster Animations', 'Restoring Animations');
    setupTweakSwitchListener('pointer-speed-switch', 'pointer_speed', 'pointer_speed_fast', 'restore_pointer_speed', 'Faster Pointer', 'Restoring Pointer');
    setupTweakSwitchListener('immersive-mode-switch', 'immersive_mode', 'confirm_immersive_mode', 'restore_immersive_mode', 'Confirming Immersive Mode', 'Restoring Immersive Mode');
    setupTweakSwitchListener('wifi-scan-switch', 'wifi_scan', 'disable_wifi_scan', 'restore_wifi_scan', 'Disabling WiFi Scan', 'Enabling WiFi Scan');
    setupTweakSwitchListener('wifi-power-save-switch', 'wifi_power_save', 'disable_wifi_power_save', 'restore_wifi_power_save', 'Disabling WiFi Power Save', 'Enabling WiFi Power Save');
    setupTweakSwitchListener('vibration-switch', 'vibration_control', 'vibration_control_off', 'restore_vibration_control', 'Disabling Haptics', 'Enabling Haptics');
    setupTweakSwitchListener('background-limiter-switch', 'background_limiter', 'background_limiter_on', 'restore_background_limiter', 'Limiting BG Processes', 'Restoring BG Limit');
    setupTweakSwitchListener('boot-optimizer-switch', 'boot_optimizer', 'boot_optimizer_on', 'restore_boot_optimizer', 'Disabling Boot Sound', 'Enabling Boot Sound');
    setupTweakSwitchListener('tether-offload-switch', 'tether_offload', 'disable_tethering_offload', 'restore_tethering_offload', 'Disabling Tether Offload', 'Enabling Tether Offload');
    setupTweakSwitchListener('triple-buffering-switch', 'triple_buffering', 'triple_buffering_enable', 'restore_triple_buffering_enable', 'Enabling Triple Buffering', 'Disabling Triple Buffering');

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
        saveTweakSetting('dpi', dpi); 
        runTweakFlow(COMMANDS.set_dpi.replace('{value}', dpi), getLangString('tweaks_dpi_label')); 
    });
    document.getElementById("reset-dpi-btn")?.addEventListener("click", () => { 
        saveTweakSetting('dpi', ''); document.getElementById('dpi-input').value = ''; 
        runTweakFlow(COMMANDS.reset_dpi, getLangString('tweaks_dpi_label')); 
    });

    const setupUtilityButton = (btnId, langKey) => {
        const btn = document.getElementById(btnId);
        if (btn) {
            const commandKey = btn.id.replace('-btn', '').replace('clear', 'clear_').replace('ram-cleaner', 'utilityRamClean').replace('clear-cache', 'utilityStorageClean').replace('deep-sleep', 'force_deep_sleep').replace('log-cleaner', 'log_cleaner');
            btn.addEventListener("click", () => {
                const command = PERFORMANCE_COMMANDS[commandKey] || COMMANDS[commandKey];
                if (command) { runCommandFlow(command, getLangString(langKey)); } 
                else { getAlpine().showNotification("Utility command not found."); }
            });
        }
    };
    setupUtilityButton('ram-cleaner-btn', 'tweaks_ram_cleaner');
    setupUtilityButton('clear-cache-btn', 'tweaks_cache_clean');
    setupUtilityButton('deep-sleep-btn', 'tweaks_deep_sleep');
    setupUtilityButton('log-cleaner-btn', 'tweaks_log_cleaner');

    document.getElementById("restore-tweaks-btn")?.addEventListener("click", async () => { 
        if (await getAlpine().showConfirm(getLangString("notification_confirm_restore_tweaks"))) { 
            runTweakFlow(Object.values(RESTORE_COMMANDS).join(' && '), getLangString("tweaks_restore_all_btn")); 
            localStorage.removeItem('tweakSettings'); 
            setTimeout(() => location.reload(), 2500); 
        } 
    });
    document.getElementById("custom-module-btn")?.addEventListener("click", (e) => { 
        if (e.currentTarget.textContent === getLangString('custom_module_select_btn')) document.getElementById("custom-module-input").click(); 
        else handleCustomModule(); 
    });
    document.getElementById("custom-module-input")?.addEventListener("change", (e) => { 
        const btn = document.getElementById("custom-module-btn"); 
        if (e.target.files.length && e.target.files[0].name.endsWith('.sh')) { 
            btn.textContent = getLangString('custom_command_run_btn'); btn.className = "btn bg-purple-600 text-white hover:bg-purple-500"; 
        } 
    });
    document.getElementById("run-custom-command-btn")?.addEventListener("click", handleCustomCommand);
    document.getElementById("clear-logs-btn-custom")?.addEventListener("click", clearAllLogs);
    document.getElementById("restore-device-btn")?.addEventListener("click", () => { 
        const module = allFakeDevices.find(d => d.name === "Restore Device"); 
        if(module) handleRestore(module.name, module.url, activeFakeDevices, "activeFakeDevices", renderFakeDevices, allFakeDevices); 
    });
    document.getElementById("restore-fps-btn")?.addEventListener("click", () => { 
        const module = allFpsModules.find(m => m.name === "Stop Module"); 
        if(module) handleRestore(module.name, module.url, activeModules, "activeModules", renderFpsModules, allFpsModules); 
    });
    
    document.getElementById("scan-games-btn")?.addEventListener("click", scanInstalledGames);
    document.getElementById("restore-game-settings-btn")?.addEventListener("click", restoreGameSettings);

    document.getElementById('shizuku-tutorial-btn')?.addEventListener('click', () => { window.open('https://vt.tiktok.com/ZSAqLcegA/', '_blank'); });

    document.getElementById('shizuku-recheck-btn')?.addEventListener('click', async () => {
        const btn = document.getElementById('shizuku-recheck-btn');
        btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>Checking...`; btn.disabled = true;
        const shizukuOkNow = await checkShizukuStatus();
        if (shizukuOkNow) {
            getAlpine().activeModal = ''; getAlpine().showNotification(getLangString('notification_shizuku_connected'));
            await initializeAppFeatures();
        } else {
            getAlpine().showNotification(getLangString('notification_shizuku_still_not_running'));
            btn.innerHTML = `<i class="fas fa-sync-alt mr-2"></i><span data-lang-key="modal_shizuku_recheck_btn"></span>`;
            translateUI();
            btn.disabled = false;
        }
    });
}