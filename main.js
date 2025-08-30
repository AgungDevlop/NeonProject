document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadCommands(); 
        loadTweakSettings();
        await Promise.all([
            loadModules(), 
            loadFpsModules(), 
            loadFakeDevices(), 
            loadGames(),
            loadPerformanceCommands(), 
            checkForUpdates()
        ]);
        
        renderLogs(); 
        renderTweakComponents(); 
        initializeDiagnosisChart(); 
        applyStoredTweaks();

        const shizukuOk = await checkShizukuStatus();
        if (shizukuOk) { 
            await checkDnsStatus(); 
            await initializeDashboard(); 
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
                const command = COMMANDS[value];
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
                } else {
                    console.error(`Command not found for key: ${commandKey}`);
                }
            });
        }
    };

    setupTweakRadioListener('renderer-options', 'renderer');

    setupTweakSwitchListener('thermal-switch', 'thermal', 'disable_thermal', 'restore_thermal', 'Disabling Thermal Throttling', 'Restoring Thermal Throttling');
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

    const applyPerAppTweak = (commandKey, moduleName) => {
        const pkgInput = document.getElementById("package-name-input");
        const packageName = pkgInput.value.trim();
        if (!packageName) {
            getAlpine().showNotification("Please enter a package name first.");
            return;
        }
        const commandTemplate = COMMANDS[commandKey];
        if (commandTemplate) {
            const finalCommand = commandTemplate.replace(/{packageName}/g, packageName);
            runCommandFlow(finalCommand, `${moduleName} for ${packageName}`);
        }
    };

    document.getElementById("apply-angle-btn")?.addEventListener("click", () => {
        applyPerAppTweak('force_angle_for_app', 'Force ANGLE');
    });

    document.getElementById("apply-updatable-driver-btn")?.addEventListener("click", () => {
        applyPerAppTweak('force_updatable_driver_for_app', 'Force Updatable Driver');
    });

    document.getElementById("set-dpi-btn")?.addEventListener("click", () => { 
        const dpi = document.getElementById("dpi-input").value; 
        if (!dpi) return; 
        saveTweakSetting('dpi', dpi); 
        runTweakFlow(COMMANDS.set_dpi.replace('{value}', dpi), 'DPI Changer'); 
    });
    document.getElementById("reset-dpi-btn")?.addEventListener("click", () => { 
        saveTweakSetting('dpi', ''); 
        document.getElementById('dpi-input').value = ''; 
        runTweakFlow(COMMANDS.reset_dpi, 'DPI Changer'); 
    });
    const setupUtilityButton = (btnId, commandKey) => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.addEventListener("click", () => {
                const command = PERFORMANCE_COMMANDS[commandKey] || COMMANDS[commandKey];
                if (command) {
                    runCommandFlow(command, btn.textContent.trim()); 
                } else { 
                    getAlpine().showNotification("Utility command not found."); 
                }
            });
        }
    };
    setupUtilityButton('ram-cleaner-btn', 'utilityRamClean');
    setupUtilityButton('clear-cache-btn', 'utilityStorageClean');
    setupUtilityButton('deep-sleep-btn', 'force_deep_sleep');
    setupUtilityButton('log-cleaner-btn', 'log_cleaner');
    document.getElementById("restore-tweaks-btn")?.addEventListener("click", async () => { 
        if (await getAlpine().showConfirm("Restore all tweaks to their default values? This action will reload the app.")) { 
            const allRestoreCommands = Object.values(RESTORE_COMMANDS).join(' && ');
            runTweakFlow(allRestoreCommands, "Restore All Tweaks"); 
            localStorage.removeItem('tweakSettings'); 
            setTimeout(() => location.reload(), 2500); 
        } 
    });
    document.getElementById("custom-module-btn")?.addEventListener("click", (e) => { 
        if (e.currentTarget.textContent === "Select") document.getElementById("custom-module-input").click(); 
        else handleCustomModule(); 
    });
    document.getElementById("custom-module-input")?.addEventListener("change", (e) => { 
        const btn = document.getElementById("custom-module-btn"); 
        if (e.target.files.length && e.target.files[0].name.endsWith('.sh')) { 
            btn.textContent = "Run"; 
            btn.className = "btn bg-purple-600 text-white hover:bg-purple-500"; 
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
}