async function handleCustomModule() {
    const fileInput = document.getElementById("custom-module-input"),
        file = fileInput.files[0],
        button = document.getElementById("custom-module-btn");

    const resetBtn = () => {
        fileInput.value = '';
        button.textContent = "Select";
        button.className = "btn btn-primary";
    };

    if (!file || !file.name.endsWith('.sh') || !window.Android || !(await checkShizukuStatus())) {
        getAlpine().showNotification("Please select a valid .sh file with Shizuku running.");
        resetBtn();
        return;
    }

    const moduleName = file.name.replace(/\.sh$/, '');
    if (activeModules.has(moduleName)) {
        getAlpine().showNotification("This module is already active.");
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
    if (!command) return getAlpine().showNotification("Please enter a command.");
    if (!(await checkShizukuStatus())) return getAlpine().showNotification("Shizuku is not running.");
    runCommandFlow(command, "Custom Command");
}

function renderLogs() {
    ['custom'].forEach(tab => {
        const logPanel = document.getElementById(`log-list-${tab}`);
        if (!logPanel) return;
        logPanel.innerHTML = commandLogs.length === 0 ? `<p class="text-gray-400 text-sm"><i class="fas fa-info-circle mr-2"></i>No logs yet.</p>` : "";
        [...commandLogs].reverse().forEach((log, i) => {
            const index = commandLogs.length - 1 - i,
                item = document.createElement("div");
            item.className = "flex justify-between items-center bg-gray-800/50 border-l-4 border-purple-500 p-2 rounded-lg mb-1";
            item.innerHTML = `<div class="flex flex-col"><span class="text-emerald-400 text-sm"><i class="fas fa-clock mr-2"></i>${log.timestamp}</span><p class="text-sm"><i class="fas fa-terminal mr-2"></i><strong>Command:</strong> ${log.command.length > 30 ? log.command.substring(0, 27) + '...' : log.command}</p></div><div class="flex gap-2"><button class="text-emerald-400 hover:text-emerald-300" onclick="viewLog(${index})"><i class="fas fa-eye"></i></button><button class="text-red-400 hover:text-red-300" onclick="deleteLog(${index})"><i class="fas fa-trash"></i></button></div>`;
            logPanel.appendChild(item);
        });
    });
}

async function clearAllLogs() {
    const alpine = getAlpine();
    if (await alpine.showConfirm("Are you sure you want to clear all logs?")) {
        if (window.Android?.deleteLog) {
            commandLogs.forEach(log => window.Android.deleteLog(log.logId));
        }
        commandLogs = [];
        localStorage.setItem("commandLogs", "[]");
        renderLogs();
        alpine.showNotification("All logs cleared!");
    }
}

function viewLog(index) {
    const log = commandLogs[index],
        alpine = getAlpine();
    alpine.activeModal = 'commandOutput';
    setTimeout(() => {
        const outputEl = document.getElementById("cmd-output");
        outputEl.innerHTML = `<div class="font-sans text-xs mb-2"><strong>Timestamp:</strong> ${log.timestamp}<br><strong>Command:</strong> ${log.command}</div><hr class="border-gray-600 my-2">${parseAnsiColors(log.output)}`;
    }, 0);
}

async function deleteLog(index) {
    const alpine = getAlpine();
    if (await alpine.showConfirm("Delete this log?")) {
        const log = commandLogs.splice(index, 1)[0];
        if (window.Android?.deleteLog) window.Android.deleteLog(log.logId);
        localStorage.setItem("commandLogs", JSON.stringify(commandLogs));
        renderLogs();
        alpine.showNotification("Log deleted!");
    }
}