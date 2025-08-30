async function checkShizukuStatus() {
    try {
        const status = window.Android?.getShizukuStatus ? await window.Android.getShizukuStatus() : false;
        document.getElementById("shizuku-status").innerHTML = `<i class="fas ${status ? 'fa-check-circle' : 'fa-times-circle'}" style="color: ${status ? '#10b981' : '#ef4444'};"></i><span>Shizuku: ${status ? 'Running' : 'Not Running'}</span>`;
        return status;
    } catch (e) {
        console.error("Error checking Shizuku status:", e);
        document.getElementById("shizuku-status").innerHTML = `<i class="fas fa-exclamation-circle" style="color: #f59e0b;"></i><span>Shizuku: Error</span>`;
        return false;
    }
}

function executeShellCommand(command, moduleName, id) {
    return new Promise((resolve, reject) => {
        if (!window.Android?.executeCommand) {
            return reject(new Error("Android interface not available."));
        }
        let output = "";
        const originalOnShellOutput = window.onShellOutput;
        const originalRunComplete = window.runComplete;
        const timeoutId = setTimeout(() => {
            cleanup();
            reject(new Error(`Command timed out: ${moduleName}`));
        }, 30000);

        const cleanup = () => {
            clearTimeout(timeoutId);
            window.onShellOutput = originalOnShellOutput;
            window.runComplete = originalRunComplete;
        };

        window.onShellOutput = (mName, data, logId) => {
            if (logId === id) {
                output += data + "\n";
            } else if (originalOnShellOutput) {
                originalOnShellOutput(mName, data, logId);
            }
        };

        window.runComplete = (mName, success, logId) => {
            if (logId === id) {
                cleanup();
                if (success) {
                    resolve(output.trim());
                } else {
                    reject(new Error(`Command failed: ${moduleName}`));
                }
            } else if (originalRunComplete) {
                originalRunComplete(mName, success, logId);
            }
        };

        try {
            window.Android.executeCommand(command, moduleName, id);
        } catch (e) {
            cleanup();
            reject(e);
        }
    });
}

function runCommandFlow(command, moduleName, metadata = {}) {
    window.isSilentTweak = false;
    window.commandMetadata = metadata;
    getAlpine().modalMessage = "Loading Ad...";
    getAlpine().activeModal = 'processing';
    setTimeout(() => {
        const lastAdTime = localStorage.getItem('lastAdShownTime');
        const currentTime = new Date().getTime();
        
        // Cek jika belum pernah ada atau sudah lebih dari 15 detik (15000 ms)
        if (!lastAdTime || (currentTime - lastAdTime > 15000)) {
            localStorage.setItem('lastAdShownTime', currentTime); // Simpan waktu saat ini
            window.open('https://obqj2.com/4/9587058', '_blank');
        }

        window.currentCommand = command;
        fireAndForgetCommand(command, moduleName, generateRandomId());
    }, 2000); // Waktu tunggu sebelum perintah dieksekusi
}

function runTweakFlow(command, moduleName) {
    window.isSilentTweak = true;
    getAlpine().modalMessage = "Loading Ad...";
    getAlpine().activeModal = 'processing';
    setTimeout(() => {
        const lastAdTime = localStorage.getItem('lastAdShownTime');
        const currentTime = new Date().getTime();

        // Cek jika belum pernah ada atau sudah lebih dari 15 detik (15000 ms)
        if (!lastAdTime || (currentTime - lastAdTime > 15000)) {
            localStorage.setItem('lastAdShownTime', currentTime); // Simpan waktu saat ini
            window.open('https://obqj2.com/4/9587058', '_blank');
        }

        window.currentCommand = command;
        fireAndForgetCommand(command, moduleName, generateRandomId());
    }, 2000); // Waktu tunggu sebelum perintah dieksekusi
}

function fireAndForgetCommand(command, moduleName, logId) {
    if (!window.Android) {
        getAlpine().showNotification("Feature only available in the app.");
        getAlpine().activeModal = '';
        return;
    }
    try {
        window.Android.executeCommand(command, moduleName, logId);
        if (moduleName !== "SilentOp") {
            getAlpine().modalMessage = `Executing ${moduleName}...`;
            getAlpine().activeModal = 'processing';
        }
    } catch (e) {
        console.error(`Error firing command for ${moduleName}:`, e);
        getAlpine().showNotification(`Failed to start ${moduleName}.`);
        if (moduleName !== "SilentOp") window.runComplete(moduleName, false, logId);
    }
}

window.onShellOutput = function(moduleName, output, logId) {
    const silentOps = ['DeviceInfo', 'SilentOp', 'DnsCheck'];
    if (!silentOps.includes(moduleName)) {
        const outEl = document.getElementById("cmd-output");
        if (window.currentLogId !== logId) {
            outEl.innerHTML = '';
            window.currentOutput = '';
            window.currentLogId = logId;
        }
        window.currentOutput += output + "\n";
        const line = document.createElement('span');
        line.innerHTML = parseAnsiColors(output);
        outEl.appendChild(line);
        outEl.appendChild(document.createTextNode('\n'));
        outEl.scrollTop = outEl.scrollHeight;
        window.Android?.saveLog?.(window.currentOutput, logId);
    }
};

window.downloadComplete = function(moduleName, success) {
    const alpine = getAlpine();
    const progressBar = document.getElementById("modal-progress"),
        statusText = document.getElementById("modal-status");
    clearInterval(window.downloadingModuleInterval);
    progressBar.style.width = success ? "100%" : "0%";
    statusText.textContent = success ? "Complete!" : "Failed.";
    setTimeout(() => {
        if (alpine.activeModal === 'download') alpine.activeModal = '';
    }, 500);

    if (success) {
        downloadedModules.add(moduleName);
        localStorage.setItem("downloadedModules", JSON.stringify([...downloadedModules]));
        getAlpine().showNotification(`${moduleName} downloaded!`);
        if (window.downloadCallback) {
            window.downloadCallback();
            window.downloadCallback = null;
        } else {
            const module = allModules.find(m => m.name === moduleName) || allFpsModules.find(m => m.name === moduleName);
            const fakeDevice = allFakeDevices.find(d => d.name === moduleName);
            if (module) {
                handleModuleAction(module.name, module.url);
            } else if (fakeDevice) {
                handleFakeDeviceAction(fakeDevice.name, fakeDevice.url);
            }
        }
    } else {
        getAlpine().showNotification(`Download failed for ${moduleName}.`);
        window.runComplete(moduleName, false, null);
    }
};

window.runComplete = async function(moduleName, success, logId) {
    const alpine = getAlpine();
    const silentOps = ['DeviceInfo', 'SilentOp', 'DnsCheck'];
    if (silentOps.includes(moduleName)) return;

    const timestamp = new Date().toLocaleString();
    let command = window.currentCommand || "";
    commandLogs.push({ command, output: window.currentOutput, timestamp, logId });
    localStorage.setItem("commandLogs", JSON.stringify(commandLogs));
    renderLogs();

    if (window.isSilentTweak) {
        alpine.activeModal = '';
    } else {
        alpine.activeModal = 'commandOutput';
    }

    if (success) {
        alpine.showNotification(`${moduleName} executed successfully!`);
        
        if (moduleName.includes('Boosting')) {
            try {
                alpine.showNotification("Gathering final results...");
                const afterOutput = await executeShellCommand(PERFORMANCE_COMMANDS.getSystemStats, "SilentOp", `stats-after-${generateRandomId()}`);
                const afterStats = parseSystemStats(afterOutput);
                displayBoostResults(boostState.before, afterStats);
            } catch (e) {
                console.error("Failed to get after-boost stats:", e);
                document.getElementById('boost-results-container').classList.add('hidden');
                alpine.showNotification("Could not retrieve boost results.");
            } finally {
                boostState = {};
                setTimeout(() => {
                    alpine.activeModal = 'support';
                }, 1200);
            }
        }
    } else {
        alpine.showNotification(`Failed to run ${moduleName}.`);
    }

    window.currentOutput = "";
    window.currentLogId = null;
    window.currentCommand = null;
    window.isSilentTweak = false;
};
