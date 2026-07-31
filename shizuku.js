// ─── Map-based Shell Command Dispatcher ────────────────────────────────────────
// CRITICAL FIX: Old pattern overwrote window.onShellOutput/runComplete globally,
// causing any concurrent executeShellCommand() call to steal each other's callbacks
// → Promise hang for 30s → WebView freeze. Now each command registers its own
// callbacks keyed by logId inside a Map, fully concurrent-safe.
const _shellCallbacks = new Map(); // logId → { onOutput, onComplete }

// Called by Java (NeonCoreUIWebInterface) via evaluateJavascript
window.onShellOutput = function(moduleName, data, logId) {
    const cb = _shellCallbacks.get(logId);
    if (cb) {
        cb.onOutput(moduleName, data, logId);
        return;
    }
    // Fallback: visible command output (non-silent)
    const silentOps = ['DeviceInfo', 'SilentOp', 'DnsCheck'];
    if (!silentOps.includes(moduleName)) {
        const outEl = document.getElementById("cmd-output");
        if (outEl) {
            if (window.currentLogId !== logId) { outEl.innerHTML = ''; window.currentOutput = ''; window.currentLogId = logId; }
            window.currentOutput = (window.currentOutput || '') + data + "\n";
            const line = document.createElement('span');
            line.innerHTML = typeof parseAnsiColors === 'function' ? parseAnsiColors(data) : data;
            outEl.appendChild(line); outEl.appendChild(document.createTextNode('\n'));
            outEl.scrollTop = outEl.scrollHeight;
            window.Android?.saveLog?.(window.currentOutput, logId);
        }
    }
};

window.runComplete = async function(moduleName, success, logId) {
    const cb = _shellCallbacks.get(logId);
    if (cb) {
        _shellCallbacks.delete(logId);
        cb.onComplete(moduleName, success, logId);
        return;
    }
    // Fallback: handle user-visible commands
    const alpine = getAlpine();
    const silentOps = ['DeviceInfo', 'SilentOp', 'DnsCheck'];
    if (silentOps.includes(moduleName)) return;
    const timestamp = new Date().toLocaleString();
    let command = window.currentCommand || "";
    commandLogs.push({ command, output: window.currentOutput, timestamp, logId });
    localStorage.setItem("commandLogs", JSON.stringify(commandLogs));
    if (typeof renderLogs === 'function') renderLogs();

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
                document.getElementById('boost-results-container').classList.add('hidden');
                alpine.showNotification("Could not retrieve boost results.");
            } finally {
                boostState = {};
                setTimeout(() => { alpine.activeModal = 'support'; }, 1200);
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

// ─── executeShellCommand (concurrent-safe) ─────────────────────────────────────
// Each call registers its resolve/reject in _shellCallbacks under its unique logId.
// Multiple concurrent calls never interfere with each other.
function executeShellCommand(command, moduleName, id) {
    return new Promise((resolve, reject) => {
        if (!window.Android?.executeCommand) {
            return reject(new Error("Android interface not available."));
        }
        let output = "";
        const timeoutId = setTimeout(() => {
            _shellCallbacks.delete(id);
            reject(new Error(`Command timed out: ${moduleName}`));
        }, 30000);

        _shellCallbacks.set(id, {
            onOutput: (mName, data, logId) => {
                // Java now sends FULL multi-line output in ONE call (batch mode).
                // Replace output entirely — do NOT append, there is only one call.
                output = data;
            },
            onComplete: (mName, success, logId) => {
                clearTimeout(timeoutId);
                if (success) {
                    resolve(output); // Do NOT trim — preserves trailing \n needed for split
                } else {
                    reject(new Error(`Command failed: ${moduleName}`));
                }
            }
        });

        try {
            window.Android.executeCommand(command, moduleName, id);
        } catch (e) {
            clearTimeout(timeoutId);
            _shellCallbacks.delete(id);
            reject(e);
        }
    });
}


function runCommandFlow(command, moduleName, metadata = {}) {
    window.isSilentTweak = false; 
    window.commandMetadata = metadata;
    window.currentCommand = command;
    const alpine = getAlpine();
    
    if (moduleName !== "SilentOp") {
        alpine.modalMessage = `EXECUTING ${moduleName.toUpperCase()}...`; 
        alpine.activeModal = 'processing';
    }
    
    setTimeout(() => {
        fireAndForgetCommand(command, moduleName, generateRandomId());
    }, 150);
}

function runTweakFlow(command, moduleName) {
    window.isSilentTweak = true;
    window.currentCommand = command;
    const alpine = getAlpine();
    
    if (moduleName !== "SilentOp") {
        alpine.modalMessage = `APPLYING ${moduleName.toUpperCase()}...`; 
        alpine.activeModal = 'processing';
    }
    
    setTimeout(() => {
        fireAndForgetCommand(command, moduleName, generateRandomId());
    }, 150);
}

function fireAndForgetCommand(command, moduleName, logId) {
    if (!window.Android) { 
        getAlpine().showNotification("Feature only available in the app."); 
        getAlpine().activeModal = ''; 
        return; 
    }
    try {
        window.Android.executeCommand(command, moduleName, logId);
    } catch (e) { 
        getAlpine().showNotification(`Failed to start ${moduleName}.`); 
        if (moduleName !== "SilentOp") window.runComplete(moduleName, false, logId); 
    }
}



window.downloadComplete = function(moduleName, success) {
    const alpine = getAlpine();
    const progressCircle = document.querySelector(".circular-progress");
    const progressText = document.getElementById("modal-progress-text");
    const statusText = document.getElementById("modal-status");
    clearInterval(window.downloadingModuleInterval);
    if(progressCircle) progressCircle.style.setProperty('--progress-value', success ? 100 : 0);
    if(progressText) progressText.textContent = success ? "100%" : "0%";
    if(statusText) statusText.textContent = success ? "Complete!" : "Failed.";
    setTimeout(() => { if (alpine.activeModal === 'download') alpine.activeModal = ''; }, 500);
    if (success) {
        downloadedModules.add(moduleName);
        localStorage.setItem("downloadedModules", JSON.stringify([...downloadedModules]));
        getAlpine().showNotification(`${moduleName} downloaded!`);
        if (window.downloadCallback) { window.downloadCallback(); window.downloadCallback = null; }
        else { 
            const module = allFpsModules.find(m => m.name === moduleName); 
            const fakeDevice = allFakeDevices.find(d => d.name === moduleName); 
            if (module) { handleModuleAction(module.name, module.url); } 
            else if (fakeDevice) { handleFakeDeviceAction(fakeDevice.name, fakeDevice.url); } 
        }
    } else { 
        getAlpine().showNotification(`Download failed for ${moduleName}.`); 
        window.runComplete(moduleName, false, null); 
    }
};


