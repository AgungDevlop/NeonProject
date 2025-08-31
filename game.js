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

    if (!(await checkShizukuStatus())) {
        getAlpine().showNotification("Shizuku is not running. Cannot scan games.");
        loadingDiv.classList.add('hidden');
        listsDiv.classList.remove('hidden');
        return;
    }

    let installedPackages = new Set();

    try {
        console.log("Attempting to scan packages using shell command...");
        const command = "pm list packages -3 -e | cut -d : -f 2";
        const output = await executeShellCommand(command, 'SilentOp', `game-scan-shell-${generateRandomId()}`);
        installedPackages = new Set(output.split('\n').map(line => line.trim()).filter(Boolean));
        console.log(`Shell command successful. Found ${installedPackages.size} packages.`);

    } catch (e) {
        console.warn("Shell command failed, falling back to native Java method.", e);
        getAlpine().showNotification("Shell scan failed. Trying native method...");

        if (window.Android && window.Android.getInstalledPackages) {
            try {
                console.log("Calling native getInstalledPackages()...");
                const packagesJson = await window.Android.getInstalledPackages();
                const packageList = JSON.parse(packagesJson);
                installedPackages = new Set(packageList);
                console.log(`Native method successful. Found ${installedPackages.size} packages.`);
            } catch (nativeError) {
                console.error("Native package scan also failed:", nativeError);
                getAlpine().showNotification("Error: Both scan methods failed.");
                loadingDiv.classList.add('hidden');
                listsDiv.classList.remove('hidden');
                return;
            }
        } else {
            getAlpine().showNotification("Error scanning games. Native fallback not available.");
            loadingDiv.classList.add('hidden');
            listsDiv.classList.remove('hidden');
            return;
        }
    }

    try {
        lastFoundGames = allGames.filter(game => installedPackages.has(game.nama_paket));
        renderGames(lastFoundGames);
    } catch (processingError) {
        console.error("Error processing scan results:", processingError);
        getAlpine().showNotification("Error displaying scanned games.");
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
                        <small>by ${game.developer}</small>
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
                        <small>by ${game.developer}</small>
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
        getAlpine().showNotification("Shizuku is not running.");
        return;
    }

    if (!PERFORMANCE_COMMANDS || !PERFORMANCE_COMMANDS.getSystemStats || !PERFORMANCE_COMMANDS.fullGameBoost) {
        getAlpine().showNotification("Performance commands not loaded. Check performance.json.");
        return;
    }

    try {
        getAlpine().showNotification("Gathering initial system stats...");
        const beforeOutput = await executeShellCommand(PERFORMANCE_COMMANDS.getSystemStats, "SilentOp", `stats-before-${generateRandomId()}`);
        boostState.before = parseSystemStats(beforeOutput);

        const commandTemplate = PERFORMANCE_COMMANDS.fullGameBoost;
        const finalCommand = commandTemplate.replace(/{packageName}/g, packageName);

        runCommandFlow(finalCommand, `Boosting ${gameName}`);
    } catch (e) {
        getAlpine().showNotification("Failed to start boost process.");
        console.error("Boost process failed:", e);
    }
}

// ===== PENAMBAHAN FUNGSI BARU =====
async function restoreGameSettings() {
    if (!(await checkShizukuStatus())) {
        getAlpine().showNotification("Shizuku is not running.");
        return;
    }

    const confirmed = await getAlpine().showConfirm("Are you sure you want to restore all performance settings to default? A reboot is recommended after this action.");
    if (!confirmed) {
        getAlpine().showNotification("Restore cancelled.");
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
            // Fungsi runCommandFlow akan menangani tampilan proses, eksekusi, dan output
            runCommandFlow(commandToRun, "Restoring Default Settings");
        } else {
            throw new Error("'restoreSystemDefaults' command not found in restore_game.json");
        }
    } catch (error) {
        console.error("Error during restore process:", error);
        getAlpine().showNotification(`Restore Error: ${error.message}`);
        getAlpine().hideProcessing();
    }
}
// =====================================

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