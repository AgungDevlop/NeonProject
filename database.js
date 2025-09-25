document.addEventListener('alpine:init', () => {
    Alpine.data('databaseApp', () => ({
        activeModal: '',
        modalMessage: '',
        notification: { show: false, message: '' },
        confirmResolver: null,
        showNotification(message, duration = 4000) {
            this.notification.message = message;
            this.notification.show = true;
            setTimeout(() => { this.notification.show = false; }, duration);
        },
        showConfirm(message) {
            this.modalMessage = message; 
            this.activeModal = 'confirm';
            return new Promise(resolve => { this.confirmResolver = resolve; });
        },
        resolveConfirm(value) { 
            this.confirmResolver?.(value); 
            this.activeModal = ''; 
        },
    }));
});

const randomUrls = [
    'https://enviousgarbage.com/HE9TFh',
    'https://obqj2.com/4/9587058',
    'https://aviatorreproducesauciness.com/2082665',
    'https://viidedss.com/dc/?blockID=388556'
];

function getAlpine() { return document.body._x_dataStack[0]; }
function generateRandomId() { return Array.from({ length: 15 }, () => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ01223456789'.charAt(Math.floor(Math.random() * 62))).join(''); }
function parseAnsiColors(text) { if (!text) return ''; const ansiMap = { '\x1B[0;31m': '<span class="ansi-red">', '\x1B[0;32m': '<span class="ansi-green">', '\x1B[0;36m': '<span class="ansi-cyan">', '\x1B[1;33m': '<span class="ansi-yellow">', '\x1B[0m': '</span>' }; let html = text.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]); return Object.entries(ansiMap).reduce((acc, [ansi, tag]) => acc.replace(new RegExp(ansi.replace(/\[/g, '\\['), 'g'), tag), html); }

let moduleStates = JSON.parse(localStorage.getItem('moduleStates')) || {};
let moduleZipMap = JSON.parse(localStorage.getItem('moduleZipMap')) || {};
const BASE_PATH = "/storage/emulated/0/Download/com.fps.injector/modules/";
let allModulesData = [];
let onNextComplete = null;

function sanitizeName(name) { return name.replace(".zip", "").replace(/[^a-zA-Z0-9.-]/g, '_'); }
function saveModuleStates() { localStorage.setItem('moduleStates', JSON.stringify(moduleStates)); }
function saveModuleZipMap() { localStorage.setItem('moduleZipMap', JSON.stringify(moduleZipMap)); }

function showInterstitialAd() {
    if (sessionStorage.getItem('adShownInSession')) {
        return;
    }
    const alpine = getAlpine();
    alpine.modalMessage = 'Loading ads...';
    alpine.activeModal = 'processing';
    setTimeout(() => {
        const randomUrl = randomUrls[Math.floor(Math.random() * randomUrls.length)];
        window.open(randomUrl, '_blank');
        sessionStorage.setItem('adShownInSession', 'true');
        setTimeout(() => {
            if (alpine.activeModal === 'processing') {
                alpine.activeModal = '';
            }
        }, 500);
    }, 2000);
}

async function loadDatabase() {
    const loadingDiv = document.getElementById('db-loading');
    try {
        const response = await fetch('database.json', { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        allModulesData = await response.json();
        if(loadingDiv) loadingDiv.remove();
        await renderModules(allModulesData);
    } catch (error) {
        console.error("Error loading database.json:", error);
        if(loadingDiv) loadingDiv.innerHTML = `<p class="text-red-400 text-sm p-4"><i class="fas fa-exclamation-circle mr-2"></i>Failed to load module database.</p>`;
    }
}

async function renderModules(modules) {
    const container = document.getElementById('module-list-container');
    container.innerHTML = '';
    if (modules.length === 0) {
        container.innerHTML = `<div id="no-results" class="text-center text-gray-400 p-8">No modules found.</div>`;
        return;
    }
    for (const module of modules) {
        await renderSingleModule(module, container);
    }
    if (!document.getElementById('no-results')) {
        container.insertAdjacentHTML('beforeend', `<div id="no-results" class="text-center text-gray-400 p-8 hidden">No modules match your search.</div>`);
    }
}

async function renderSingleModule(module, container) {
    const moduleDirName = sanitizeName(module.name);
    const isInstalled = window.Android?.checkFileExists ? await window.Android.checkFileExists(BASE_PATH + moduleDirName) : false;
    const followIcon = getFollowIcon(module.follow);
    const followLink = module.follow ? `<a href="${module.follow}" target="_blank" class="text-gray-400 hover:text-emerald-400 transition-colors text-lg ml-2">${followIcon}</a>` : '';
    const listItem = document.createElement('div');
    listItem.className = 'module-item flex items-center justify-between p-4';
    listItem.dataset.name = module.name.toLowerCase();
    let actionHtml;
    if (isInstalled) {
        actionHtml = createInstalledActionsHtml(moduleDirName, module.name);
    } else {
        actionHtml = createDownloadHtml(module.name, module.url);
    }
    listItem.innerHTML = `
        <div class="flex-grow">
            <h3 class="font-bold text-white">${module.name}</h3>
            <p class="text-sm text-gray-400 mt-1 flex items-center">by ${module.credit}${followLink}</p>
        </div>
        <div id="action-container-${moduleDirName}" class="flex-shrink-0">${actionHtml}</div>
    `;
    container.appendChild(listItem);
}

function createInstalledActionsHtml(moduleDirName, moduleName) {
    const isChecked = moduleStates[moduleDirName] ? 'checked' : '';
    return `<div class="flex items-center gap-2"><label class="switch"><input type="checkbox" onchange="toggleModule('${moduleDirName}', '${moduleName}', this)" ${isChecked}><span class="slider"></span></label><button onclick="removeModule('${moduleDirName}', '${moduleName}')" class="text-red-500 hover:text-red-400 text-lg w-10 h-10 flex items-center justify-center"><i class="fas fa-trash"></i></button></div>`;
}

function createDownloadHtml(moduleName, url) {
    return `<button onclick="downloadModule('${moduleName}', '${url}')" class="text-emerald-400 hover:text-emerald-300 text-xl w-10 h-10 flex items-center justify-center"><i class="fas fa-download"></i></button>`;
}

function getFollowIcon(url) {
    if (!url) return '';
    if (url.includes('youtube')) return '<i class="fab fa-youtube"></i>';
    if (url.includes('instagram')) return '<i class="fab fa-instagram"></i>';
    if (url.includes('tiktok')) return '<i class="fab fa-tiktok"></i>';
    return '<i class="fas fa-globe"></i>';
}

function downloadModule(moduleName, url) {
    if (!window.Android?.downloadZipModule) { getAlpine().showNotification("This feature is only available in the app."); return; }
    const alpine = getAlpine();
    alpine.activeModal = 'download';
    document.getElementById("modal-title").innerHTML = `<i class="fas fa-download mr-2"></i>Downloading ${moduleName}`;
    document.getElementById("modal-status").textContent = "Starting download...";
    window.Android.downloadZipModule(url, moduleName);
}

window.downloadComplete = function(moduleName, success, fileName) {
    if (success) {
        getAlpine().showNotification(`${moduleName} downloaded.`);
        document.getElementById("modal-status").textContent = "Download complete! Unzipping...";
        if (window.Android?.unzipModule && fileName) {
            const moduleDirName = sanitizeName(moduleName);
            moduleZipMap[moduleDirName] = fileName;
            saveModuleZipMap();
            window.Android.unzipModule(fileName, moduleDirName);
        }
    } else {
        getAlpine().showNotification(`Download failed for ${moduleName}.`);
        getAlpine().activeModal = '';
    }
};

window.unzipComplete = function(success, moduleDirName) {
    const alpine = getAlpine();
    if (alpine.activeModal === 'download') alpine.activeModal = '';
    if (success) {
        alpine.showNotification(`Module installed successfully.`);
        moduleStates[moduleDirName] = false;
        saveModuleStates();
        const actionContainer = document.getElementById(`action-container-${moduleDirName}`);
        if (actionContainer) {
            const moduleName = actionContainer.closest('.module-item').querySelector('h3').textContent;
            actionContainer.innerHTML = createInstalledActionsHtml(moduleDirName, moduleName);
        }
        showInterstitialAd();
    } else {
        alpine.showNotification(`Error unzipping module.`);
    }
}

async function findModuleScript(moduleDirName, type) {
    const scripts = type === 'install' 
        ? ['install.sh', 'run.sh', 'exec.sh'] 
        : ['remove.sh', 'del.sh', 'delete.sh'];
    if (!window.Android?.checkFileExists) return null;
    for (const script of scripts) {
        const path = `${BASE_PATH}${moduleDirName}/${script}`;
        if (await window.Android.checkFileExists(path)) return script;
    }
    return null;
}

async function toggleModule(moduleDirName, moduleDisplayName, checkbox) {
    const alpine = getAlpine();
    const isActivating = checkbox.checked;
    alpine.modalMessage = `${isActivating ? 'Activating' : 'Deactivating'} ${moduleDisplayName}...`;
    alpine.activeModal = 'processing';
    await new Promise(resolve => setTimeout(resolve, 50)); 
    const scriptType = isActivating ? 'install' : 'remove';
    const scriptName = await findModuleScript(moduleDirName, scriptType);
    if (!scriptName) {
        alpine.showNotification(`No ${scriptType} script found for this module.`);
        checkbox.checked = !isActivating;
        alpine.activeModal = '';
        return;
    }
    moduleStates[moduleDirName] = isActivating;
    saveModuleStates();
    const logId = generateRandomId();
    window.currentCommand = `sh ${BASE_PATH}${moduleDirName}/${scriptName}`;
    window.Android.executeModuleScript(moduleDirName, scriptName, moduleDisplayName, logId);
}

async function removeModule(moduleDirName, moduleDisplayName) {
    const alpine = getAlpine();
    const confirmed = await alpine.showConfirm(`Are you sure you want to remove ${moduleDisplayName}? This will delete all its files.`);
    if (!confirmed) return;
    alpine.modalMessage = `Removing ${moduleDisplayName}...`;
    alpine.activeModal = 'processing';
    await new Promise(resolve => setTimeout(resolve, 50));
    const performDeletion = () => {
        const zipFileName = moduleZipMap[moduleDirName] || sanitizeName(moduleDisplayName) + ".zip";
        if (window.Android?.deleteModuleFiles) {
            window.Android.deleteModuleFiles(moduleDirName, zipFileName);
        } else {
            alpine.showNotification("Deletion function not available.");
            alpine.activeModal = '';
        }
    };
    const removeScript = await findModuleScript(moduleDirName, 'remove');
    if (removeScript) {
        onNextComplete = performDeletion;
        const logId = generateRandomId();
        window.currentCommand = `sh ${BASE_PATH}${moduleDirName}/${removeScript}`;
        window.Android.executeModuleScript(moduleDirName, removeScript, `Uninstalling ${moduleDisplayName}`, logId);
    } else {
        performDeletion();
    }
}

window.deletionComplete = function(success, moduleDirName) {
    const alpine = getAlpine();
    alpine.activeModal = '';
    if(success) {
        alpine.showNotification("Module removed successfully!");
        delete moduleStates[moduleDirName];
        delete moduleZipMap[moduleDirName];
        saveModuleStates();
        saveModuleZipMap();
        const actionContainer = document.getElementById(`action-container-${moduleDirName}`);
        if(actionContainer) {
            const listItem = actionContainer.closest('.module-item');
            const moduleData = allModulesData.find(m => sanitizeName(m.name) === moduleDirName);
            if (moduleData) { 
                actionContainer.innerHTML = createDownloadHtml(moduleData.name, moduleData.url);
            } else { 
                listItem.remove();
            }
        }
    } else {
        alpine.showNotification("Failed to remove all module files.");
    }
};

window.onShellOutput = function(moduleName, output, logId) {
    const outEl = document.getElementById("cmd-output");
    if (window.currentLogId !== logId) {
        outEl.innerHTML = ''; window.currentOutput = ''; window.currentLogId = logId;
    }
    window.currentOutput += output + "\n";
    outEl.innerHTML += parseAnsiColors(output) + '\n';
    outEl.scrollTop = outEl.scrollHeight;
};

window.runComplete = function(moduleName, success, logId) {
    const alpine = getAlpine();
    alpine.activeModal = 'commandOutput';
    if (success) {
        alpine.showNotification(`${moduleName} executed successfully!`);
    } else {
        alpine.showNotification(`Failed to run ${moduleName}.`);
    }
    window.currentOutput = ""; window.currentLogId = null; window.currentCommand = null;
    if (typeof onNextComplete === 'function') {
        onNextComplete();
        onNextComplete = null;
    }
};

function setupEventListeners() {
    document.getElementById('install-local-btn').addEventListener('click', () => {
        document.getElementById('local-zip-input').click();
    });
    document.getElementById('local-zip-input').addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file || !file.name.endsWith('.zip')) {
            getAlpine().showNotification('Please select a valid .zip file.');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64String = e.target.result.split(',')[1];
            getAlpine().modalMessage = `Installing ${file.name}...`;
            getAlpine().activeModal = 'processing';
            if(window.Android?.installLocalZipModule) {
                window.Android.installLocalZipModule(file.name, base64String);
            }
        };
        reader.readAsDataURL(file);
        event.target.value = '';
    });
    document.getElementById('search-input').addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const modules = document.querySelectorAll('.module-item');
        let visibleCount = 0;
        modules.forEach(module => {
            const name = module.dataset.name;
            if (name.includes(searchTerm)) {
                module.style.display = 'flex';
                visibleCount++;
            } else {
                module.style.display = 'none';
            }
        });
        const noResultsDiv = document.getElementById('no-results');
        if(noResultsDiv) noResultsDiv.style.display = visibleCount === 0 ? 'block' : 'none';
    });
}

window.localInstallComplete = async function(success, moduleDirName, originalFileName) {
    const alpine = getAlpine();
    alpine.activeModal = '';
    if(success) {
        alpine.showNotification('Local module installed successfully!');
        const newModuleName = originalFileName.replace(".zip", "");
        const newModule = { name: newModuleName, credit: 'Installed locally', follow: '', url: '' };
        allModulesData.push(newModule);
        moduleZipMap[moduleDirName] = originalFileName;
        saveModuleZipMap();
        await renderSingleModule(newModule, document.getElementById('module-list-container'));
        showInterstitialAd();
    } else {
        alpine.showNotification('Failed to install local module.');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadDatabase();
    setupEventListeners();
});