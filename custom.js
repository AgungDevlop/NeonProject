async function handleCustomModule() {
    const fileInput = document.getElementById("custom-module-input"),
        file = fileInput.files[0],
        button = document.getElementById("custom-module-btn");

    const resetBtn = () => {
        fileInput.value = '';
        button.textContent = "Browse Local";
    };

    if (!file || !file.name.endsWith('.sh') || !window.Android || !(await checkShizukuStatus())) {
        getAlpine().showNotification("Context inactive. Execution simulated.");
        resetBtn();
        return;
    }

    const moduleName = file.name.replace(/\.sh$/, '');
    if (activeModules.has(moduleName)) {
        getAlpine().showNotification("Target process already running.");
        resetBtn();
        return;
    }

    activeModules.add(moduleName);
    localStorage.setItem("activeModules", JSON.stringify([...activeModules]));

    const reader = new FileReader();
    reader.onload = async (e) => {
        const filePath = `/storage/emulated/0/Download/com.fps.injector/${moduleName.replace(/[^a-zA-Z0-9]/g, '')}.sh`;
        await window.Android.saveCustomModule(e.target.result, filePath);
        let runCommand = `sh ${filePath} && rm ${filePath}`;
        if (selectedGames.size > 0) {
            const packageNames = [...selectedGames].map(gameName => allGames.find(g => g.nama_game === gameName)?.nama_paket).filter(Boolean);
            if (packageNames.length > 0) {
                runCommand = `sh ${filePath} ${packageNames.join(' ')} && rm ${filePath}`;
            }
        }
        runCommandFlow(runCommand, moduleName);
    };
    reader.readAsText(file);
}

async function handleCustomCommand() {
    const command = document.getElementById("custom-command-input").value.trim();
    if (!command) return getAlpine().showNotification("Empty command buffer.");
    if (!(await checkShizukuStatus())) return getAlpine().showNotification("Simulating command success. System disconnected.");
    runCommandFlow(command, "Remote Shell");
}

function renderLogs() {
    ['custom'].forEach(tab => {
        const logPanel = document.getElementById(`log-list-${tab}`);
        if (!logPanel) return;
        logPanel.innerHTML = commandLogs.length === 0 ? `<p class="text-gray-600 text-[9px] uppercase tracking-widest text-center mt-4">Buffer empty</p>` : "";
        [...commandLogs].reverse().forEach((log, i) => {
            const index = commandLogs.length - 1 - i,
                item = document.createElement("div");
            item.className = "flex justify-between items-center border-b border-sysBorder py-1.5 mb-1";
            item.innerHTML = `<div class="flex flex-col"><span class="text-gray-500 text-[8px]">${log.timestamp}</span><p class="text-[9px] text-gray-300 truncate w-40">>${log.command}</p></div><div class="flex gap-2"><button class="text-gray-400 hover:text-white" onclick="viewLog(${index})"><i class="fas fa-eye text-[10px]"></i></button><button class="text-red-600 hover:text-red-400" onclick="deleteLog(${index})"><i class="fas fa-times text-[10px]"></i></button></div>`;
            logPanel.appendChild(item);
        });
    });
}

async function clearAllLogs() {
    const alpine = getAlpine();
    if (await alpine.showConfirm("Purge local trace logs?")) {
        if (window.Android && window.Android.deleteLog) {
            commandLogs.forEach(log => window.Android.deleteLog(log.logId));
        }
        commandLogs = [];
        localStorage.setItem("commandLogs", "[]");
        renderLogs();
        alpine.showNotification("Buffer purged.");
    }
}

function viewLog(index) {
    const log = commandLogs[index],
        alpine = getAlpine();
    alpine.activeModal = 'commandOutput';
    setTimeout(() => {
        const outputEl = document.getElementById("cmd-output");
        outputEl.innerHTML = `<div class="text-[9px] text-gray-500 mb-2 border-b border-sysBorder pb-2">TIME: ${log.timestamp}<br>CMD: ${log.command}</div>${parseAnsiColors(log.output)}`;
    }, 0);
}

async function deleteLog(index) {
    const alpine = getAlpine();
    if (await alpine.showConfirm("Drop selected trace?")) {
        const log = commandLogs.splice(index, 1)[0];
        if (window.Android && window.Android.deleteLog) window.Android.deleteLog(log.logId);
        localStorage.setItem("commandLogs", JSON.stringify(commandLogs));
        renderLogs();
    }
}
