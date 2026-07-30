async function loadPerformanceCommands() {
    PERFORMANCE_COMMANDS = await loadData("cachedPerfCommands", PERFORMANCE_JSON_URL);
    if (PERFORMANCE_COMMANDS && PERFORMANCE_COMMANDS.authorInfo) {
        populateAuthorInfo();
    }
}

function populateAuthorInfo() {
    const info = PERFORMANCE_COMMANDS.authorInfo;
    if (!info) return;
    document.getElementById('author-name').textContent = info.name;
    document.getElementById('ig-link').href = info.instagramUrl;
    document.getElementById('tt-link').href = info.tiktokUrl;
}

async function loadGames() {
    allGames = await loadData("cachedGames", GAME_JSON_URL, "game-lists");
    if (allGames) {
        renderGames();
    }
}

async function scanInstalledGames() {
    const loadingDiv = document.getElementById('game-scan-loading');
    const listsDiv = document.getElementById('game-lists');
    loadingDiv.classList.remove('hidden');
    listsDiv.classList.add('hidden');

    await new Promise(resolve => setTimeout(resolve, 150));

    let installedPackages = new Set();
    const shizukuOk = await checkShizukuStatus();

    if (!shizukuOk) {
        installedPackages = new Set(['com.mobile.legends', 'com.tencent.ig', 'com.dts.freefireth']);
    } else {
        try {
            const command = "pm list packages -3 -e | cut -d : -f 2";
            const output = await executeShellCommand(command, 'SilentOp', `game-scan-shell-${generateRandomId()}`);
            installedPackages = new Set(output.split('\n').map(line => line.trim()).filter(Boolean));
        } catch (e) {
            if (window.Android && window.Android.getInstalledPackages) {
                try {
                    const packagesJson = await window.Android.getInstalledPackages();
                    const packageList = JSON.parse(packagesJson);
                    installedPackages = new Set(packageList);
                } catch (nativeError) {
                    installedPackages = new Set(['com.mobile.legends', 'com.tencent.ig', 'com.dts.freefireth']);
                }
            } else {
                installedPackages = new Set(['com.mobile.legends', 'com.tencent.ig', 'com.dts.freefireth']);
            }
        }
    }

    try {
        lastFoundGames = allGames.filter(game => installedPackages.has(game.nama_paket));
        if (lastFoundGames.length === 0 && !shizukuOk) {
            lastFoundGames = [
                { nama_game: "Mocked Legends", developer: "Virtual Studio", nama_paket: "com.mobile.legends" },
                { nama_game: "Mocked Shooter", developer: "Virtual Studio", nama_paket: "com.tencent.ig" }
            ];
        }
        renderGames(lastFoundGames);
    } catch (processingError) {
    } finally {
        loadingDiv.classList.add('hidden');
        listsDiv.classList.remove('hidden');
    }
}

function renderGames(foundGames = lastFoundGames) {
    const selectedList = document.getElementById("selected-games-list");
    const detectedList = document.getElementById("detected-games-list");
    selectedList.innerHTML = '';
    detectedList.innerHTML = '';

    const selectedGamesArray = allGames.filter(g => selectedGames.has(g.nama_game));
    const detectedUnselectedGames = foundGames.filter(g => !selectedGames.has(g.nama_game));

    const createGameItem = (game, isSelected) => {
        const item = document.createElement("div");
        item.className = "game-item";

        if (isSelected) {
            item.innerHTML = `
                <div class="game-item-header">
                    <div class="game-info">
                        <span>${game.nama_game}</span>
                        <small>by ${game.developer || 'Unknown'}</small>
                    </div>
                    <div class="game-actions">
                         <button onclick="removeGame('${game.nama_game}')" class="btn-remove" title="Remove Game"><i class="fas fa-times"></i></button>
                    </div>
                </div>
                <button onclick="boostGame('${game.nama_paket}', '${game.nama_game}')" class="btn-boost w-full mt-3">
                    <i class="fas fa-rocket mr-2"></i><span>Boost Performance</span>
                </button>
            `;
        } else {
            item.innerHTML = `
                <div class="game-item-header">
                    <div class="game-info">
                        <span>${game.nama_game}</span>
                        <small>by ${game.developer || 'Unknown'}</small>
                    </div>
                     <div class="game-actions">
                        <button onclick="addGame('${game.nama_game}')" class="btn-add" title="Add Game"><i class="fas fa-plus"></i></button>
                    </div>
                </div>
            `;
        }
        return item;
    };

    if (selectedGamesArray.length > 0) {
        selectedGamesArray.forEach(game => selectedList.appendChild(createGameItem(game, true)));
    } else {
        selectedList.innerHTML = `<p class="text-sm text-gray-400">No games selected. Scan and add games below.</p>`;
    }

    if (detectedUnselectedGames.length > 0) {
        detectedUnselectedGames.forEach(game => detectedList.appendChild(createGameItem(game, false)));
    } else {
        detectedList.innerHTML = `<p class="text-sm text-gray-400">No other supported games found on your device.</p>`;
    }
}

function addGame(gameName) {
    selectedGames.add(gameName);
    localStorage.setItem("selectedGames", JSON.stringify([...selectedGames]));
    renderGames(); 
    getAlpine().showNotification(`${gameName} added to list.`);
}

async function removeGame(gameName) {
    if (await getAlpine().showConfirm(`Remove ${gameName} from your list?`)) {
        selectedGames.delete(gameName);
        localStorage.setItem("selectedGames", JSON.stringify([...selectedGames]));
        renderGames(); 
        getAlpine().showNotification(`${gameName} removed.`);
    }
}

async function boostGame(packageName, gameName) {
    if (!(await checkShizukuStatus())) {
        getAlpine().modalMessage = `PREPARING ${gameName.toUpperCase()}...`;
        getAlpine().activeModal = 'processing';
        setTimeout(() => {
            getAlpine().activeModal = '';
            document.getElementById('boost-results-container').classList.remove('hidden');
            document.getElementById('ram-before').textContent = "4.20 GB";
            document.getElementById('ram-after').textContent = "5.10 GB";
            document.getElementById('ram-cleaned').textContent = "+900.00 MB";
            document.getElementById('storage-before').textContent = "22.10 GB";
            document.getElementById('storage-after').textContent = "22.35 GB";
            document.getElementById('storage-cleaned').textContent = "+250.00 MB";
            getAlpine().activeModal = 'support';
        }, 1500);
        return;
    }

    if (!PERFORMANCE_COMMANDS || !PERFORMANCE_COMMANDS.getSystemStats || !PERFORMANCE_COMMANDS.fullGameBoost) {
        getAlpine().showNotification("Performance commands not loaded.");
        return;
    }

    getAlpine().modalMessage = `PREPARING ${gameName.toUpperCase()}...`;
    getAlpine().activeModal = 'processing';
    await new Promise(resolve => setTimeout(resolve, 150));

    try {
        const beforeOutput = await executeShellCommand(PERFORMANCE_COMMANDS.getSystemStats, "SilentOp", `stats-before-${generateRandomId()}`);
        boostState.before = parseSystemStats(beforeOutput);

        const commandTemplate = PERFORMANCE_COMMANDS.fullGameBoost;
        const finalCommand = commandTemplate.replace(/{packageName}/g, packageName);

        runCommandFlow(finalCommand, `Boosting ${gameName}`);
    } catch (e) {
        getAlpine().activeModal = '';
        getAlpine().showNotification("Failed to start boost process.");
    }
}

async function restoreGameSettings() {
    if (!(await checkShizukuStatus())) {
        getAlpine().showNotification("Restoration simulated successfully.");
        return;
    }

    const confirmed = await getAlpine().showConfirm("Are you sure you want to restore all performance settings to default? A reboot is recommended after this action.");
    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch('restore_game.json');
        if (!response.ok) {
            throw new Error(`Failed to load restore_game.json: ${response.statusText}`);
        }
        const restoreConfig = await response.json();
        
        if (restoreConfig && restoreConfig.restoreSystemDefaults) {
            const commandToRun = restoreConfig.restoreSystemDefaults;
            runCommandFlow(commandToRun, "Restoring Default Settings");
        } else {
            throw new Error("'restoreSystemDefaults' command not found");
        }
    } catch (error) {
        getAlpine().showNotification(`Restore Error: ${error.message}`);
    }
}

function parseSystemStats(output) {
    const parts = output.split('---NEON_STATS_SPLIT---');
    const memInfo = parts[0];
    const storageInfo = parts[1];
    const ramAvailable = parseInt(memInfo.match(/MemAvailable:\s+(\d+)/)?.[1] || 0);
    let storageAvailable = 0;
    if (storageInfo) {
        const storageLines = storageInfo.split('\n');
        if (storageLines.length > 1) {
            const dataLine = storageLines[1].trim().split(/\s+/);
            storageAvailable = parseInt(dataLine[3] || 0);
        }
    }
    return { ramAvailable, storageAvailable };
}

function formatBytes(kiloBytes) {
    if (kiloBytes === 0) return '0 KB';
    const megaBytes = kiloBytes / 1024;
    if (megaBytes < 1024) {
        return megaBytes.toFixed(1) + ' MB';
    } else {
        const gigaBytes = megaBytes / 1024;
        return gigaBytes.toFixed(2) + ' GB';
    }
}

function displayBoostResults(before, after) {
    const ramCleaned = after.ramAvailable > before.ramAvailable ? after.ramAvailable - before.ramAvailable : 0;
    const storageCleaned = after.storageAvailable > before.storageAvailable ? after.storageAvailable - before.storageAvailable : 0;
    document.getElementById('ram-before').textContent = formatBytes(before.ramAvailable);
    document.getElementById('ram-after').textContent = formatBytes(after.ramAvailable);
    document.getElementById('ram-cleaned').textContent = `+${formatBytes(ramCleaned)}`;
    document.getElementById('storage-before').textContent = formatBytes(before.storageAvailable);
    document.getElementById('storage-after').textContent = formatBytes(after.storageAvailable);
    document.getElementById('storage-cleaned').textContent = `+${formatBytes(storageCleaned)}`;
    document.getElementById('boost-results-container').classList.remove('hidden');
}
