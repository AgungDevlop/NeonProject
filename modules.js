async function checkModuleExists(moduleName) {
    if (!window.Android?.checkFileExists) return false;
    try {
        const fileName = moduleName.replace(/[^a-zA-Z0-9]/g, '') + ".sh",
            exists = await window.Android.checkFileExists(`/storage/emulated/0/Download/com.fps.injector/${fileName}`);
        (exists ? downloadedModules.add : downloadedModules.delete).call(downloadedModules, moduleName);
        localStorage.setItem("downloadedModules", JSON.stringify([...downloadedModules]));
        return exists;
    } catch (e) {
        console.error("Error checking file existence:", e);
        return false;
    }
}

async function loadModules() {
    allModules = await loadData("cachedModules", MODULES_URL, "module-items");
    if (allModules) {
        await Promise.all(allModules.map(m => checkModuleExists(m.name)));
        renderModules(allModules);
    }
}

async function loadFpsModules() {
    allFpsModules = await loadData("cachedFpsModules", FPS_MODULES_URL, "fps-module-items");
    if (allFpsModules) {
        await Promise.all(allFpsModules.map(m => checkModuleExists(m.name)));
        renderFpsModules(allFpsModules);
    }
}

async function loadFakeDevices() {
    allFakeDevices = await loadData("cachedFakeDevices", FAKE_DEVICE_URL, "fake-device-items");
    if (allFakeDevices) {
        await Promise.all(allFakeDevices.map(d => checkModuleExists(d.name)));
        renderFakeDevices(allFakeDevices);
    }
}

async function loadCommands() {
    COMMANDS = await loadData("cachedCommands", COMMANDS_URL);
    RESTORE_COMMANDS = await loadData("cachedRestoreCommands", RESTORE_URL);
}

function renderModules(modules) {
    const list = document.getElementById("module-items");
    list.innerHTML = "";
    const sorted = [...modules].sort((a, b) => a.name === "STOP MODULE" ? -1 : b.name === "STOP MODULE" ? 1 : 0);
    sorted.forEach(module => {
        const item = document.createElement("div");
        item.className = "bg-gray-800/50 border-l-4 border-purple-500 p-2 rounded-lg mb-1";
        if (module.name === "STOP MODULE") {
            item.innerHTML = `<button class="btn btn-primary w-full" onclick="handleModuleAction('STOP MODULE', '${module.url}')">Remove Modules</button>`;
        } else {
            item.className += " flex justify-between items-center";
            item.innerHTML = `<div class="module-text-container"><span class="flex items-center gap-2 text-sm"><i class="fas fa-microchip text-emerald-400 text-sm"></i><span>${module.name}</span></span><p class="text-[10px] text-gray-400">${module.desc}</p></div><label class="switch"><input type="checkbox" ${activeModules.has(module.name) ? 'checked' : ''}><span class="slider"></span></label>`;
            item.querySelector('input').addEventListener("change", async (e) => {
                if (e.target.checked) {
                    if (!(await checkShizukuStatus())) {
                        getAlpine().showNotification("Shizuku is not running.");
                        e.target.checked = false;
                        return;
                    }
                    handleModuleAction(module.name, module.url);
                } else {
                    if (await getAlpine().showConfirm(`Disable ${module.name}?`)) {
                        activeModules.delete(module.name);
                        localStorage.setItem("activeModules", JSON.stringify([...activeModules]));
                        renderModules(allModules);
                    } else {
                        e.target.checked = true;
                    }
                }
            });
        }
        list.appendChild(item);
    });
}

function renderFpsModules(modules) {
    const container = document.getElementById("fps-module-items");
    container.innerHTML = "";
    modules.filter(m => m.name !== "Stop Module").forEach(module => {
        const item = document.createElement("div");
        item.className = "radio-item";
        item.innerHTML = `<input type="radio" id="fps-${module.name.replace(/\s+/g, '-')}" name="fps-group" value="${module.name}" ${activeModules.has(module.name) ? 'checked' : ''}><label for="fps-${module.name.replace(/\s+/g, '-')}"><span class="flex-grow">${module.name}</span></label>`;
        container.appendChild(item);
    });
    container.addEventListener('change', (e) => {
        if (e.target.type === 'radio') {
            const selectedName = e.target.value,
                module = allFpsModules.find(m => m.name === selectedName);
            if (module) {
                allFpsModules.forEach(m => activeModules.delete(m.name));
                activeModules.add(selectedName);
                localStorage.setItem("activeModules", JSON.stringify([...activeModules]));
                handleModuleAction(selectedName, module.url);
            }
        }
    });
}

function renderFakeDevices(devices) {
    const container = document.getElementById("fake-device-items");
    container.innerHTML = "";
    devices.filter(d => d.name !== "Restore Device").forEach(device => {
        const item = document.createElement("div");
        item.className = "radio-item";
        item.innerHTML = `<input type="radio" id="device-${device.name.replace(/\s+/g, '-')}" name="device-group" value="${device.name}" ${activeFakeDevices.has(device.name) ? 'checked' : ''}><label for="device-${device.name.replace(/\s+/g, '-')}"><span class="flex-grow">${device.name}</span></label>`;
        container.appendChild(item);
    });
    container.addEventListener('change', (e) => {
        if (e.target.type === 'radio') {
            const selectedName = e.target.value,
                device = allFakeDevices.find(d => d.name === selectedName);
            if (device) {
                activeFakeDevices.clear();
                activeFakeDevices.add(selectedName);
                localStorage.setItem("activeFakeDevices", JSON.stringify([...activeFakeDevices]));
                handleFakeDeviceAction(selectedName, device.url);
            }
        }
    });
}


function handleModuleAction(moduleName, moduleUrl) {
    const fileName = moduleName.replace(/[^a-zA-Z0-9]/g, '') + ".sh";
    const modulePath = `/storage/emulated/0/Download/com.fps.injector/${fileName}`;
    if (!downloadedModules.has(moduleName)) {
        showDownloadModal(moduleName, moduleUrl);
        return;
    }
    let runCommand = `sh ${modulePath} && rm ${modulePath}`;
    if (selectedGames.size > 0 && !moduleName.includes("STOP")) {
        const packageNames = [...selectedGames].map(gameName => allGames.find(g => g.nama_game === gameName)?.nama_paket).filter(Boolean);
        if (packageNames.length > 0) {
            runCommand = `sh ${modulePath} ${packageNames.join(' ')} && rm ${modulePath}`;
        }
    }
    runCommandFlow(runCommand, moduleName);
}

function handleFakeDeviceAction(deviceName, deviceUrl) {
    const fileName = deviceName.replace(/[^a-zA-Z0-9]/g, '') + ".sh";
    const modulePath = `/storage/emulated/0/Download/com.fps.injector/${fileName}`;
    if (!downloadedModules.has(deviceName)) {
        showDownloadModal(deviceName, deviceUrl);
    } else {
        const runCommand = `sh ${modulePath} && rm ${modulePath}`;
        runCommandFlow(runCommand, deviceName);
    }
}

async function handleRestore(moduleName, moduleUrl, stateSet, key, renderFunc, allData) {
    if (!(await checkShizukuStatus())) {
        getAlpine().showNotification("Shizuku is not running.");
        return;
    }
    const fileName = moduleName.replace(/[^a-zA-Z0-9]/g, '') + ".sh";
    const modulePath = `/storage/emulated/0/Download/com.fps.injector/${fileName}`;
    const action = async () => {
        const runCommand = `sh ${modulePath} && rm ${modulePath}`;
        runCommandFlow(runCommand, moduleName);
        stateSet.forEach(item => {
            if (allData.some(d => d.name === item)) stateSet.delete(item);
        });
        localStorage.setItem(key, JSON.stringify([...stateSet]));
        renderFunc(allData);
    };
    if (!downloadedModules.has(moduleName)) {
        showDownloadModal(moduleName, moduleUrl, action);
    } else {
        action();
    }
}

function showDownloadModal(moduleName, moduleUrl, callback = null) {
    const alpine = getAlpine();
    alpine.activeModal = 'download';
    const progressBar = document.getElementById("modal-progress"),
        statusText = document.getElementById("modal-status"),
        title = document.getElementById("modal-title");
    title.innerHTML = `<i class="fas fa-download mr-2"></i>Downloading ${moduleName}`;
    statusText.textContent = "Starting...";
    progressBar.style.width = "0%";
    window.downloadCallback = callback;
    let progress = 0;
    const interval = setInterval(() => {
        progress = Math.min(progress + 5, 90);
        progressBar.style.width = `${progress}%`;
        statusText.textContent = `Progress: ${progress}%`;
    }, 200);
    window.downloadingModuleInterval = interval;
    try {
        window.Android.downloadFile(moduleUrl, moduleName);
    } catch (e) {
        getAlpine().showNotification("Failed to start download.");
        alpine.activeModal = '';
        clearInterval(interval);
        window.runComplete(moduleName, false, null);
    }
}