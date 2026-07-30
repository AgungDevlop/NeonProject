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

function getAlpine() { return document.body._x_dataStack[0]; }
function generateRandomId() { return Array.from({ length: 15 }, () => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ01223456789'.charAt(Math.floor(Math.random() * 62))).join(''); }

let moduleStates = JSON.parse(localStorage.getItem('moduleStates')) || {};
let moduleZipMap = JSON.parse(localStorage.getItem('moduleZipMap')) || {};
const BASE_PATH = "/storage/emulated/0/Download/com.fps.injector/modules/";
let allModulesData = [];
let onNextComplete = null;

function sanitizeName(name) { return name.replace(".zip", "").replace(/[^a-zA-Z0-9.-]/g, '_'); }
function saveModuleStates() { localStorage.setItem('moduleStates', JSON.stringify(moduleStates)); }
function saveModuleZipMap() { localStorage.setItem('moduleZipMap', JSON.stringify(moduleZipMap)); }

async function loadDatabase() {
    const loadingDiv = document.getElementById('db-loading');
    try {
        const response = await fetch('database.json', { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        allModulesData = await response.json();
        if(loadingDiv) loadingDiv.remove();
        await renderModules(allModulesData);
    } catch (error) {
        if(loadingDiv) loadingDiv.innerHTML = `<p class="text-red-500 text-[10px] font-mono tracking-widest">FETCH ERROR</p>`;
    }
}

async function renderModules(modules) {
    const container = document.getElementById('module-list-container');
    container.innerHTML = '';
    if (modules.length === 0) {
        container.innerHTML = `<div id="no-results" class="text-center text-gray-600 font-mono text-[10px] py-8">DB EMPTY</div>`;
        return;
    }
    for (const module of modules) {
        await renderSingleModule(module, container);
    }
    if (!document.getElementById('no-results')) {
        container.insertAdjacentHTML('beforeend', `<div id="no-results" class="text-center text-gray-600 font-mono text-[10px] py-8 hidden">NULL</div>`);
    }
}

async function renderSingleModule(module, container) {
    const moduleDirName = sanitizeName(module.name);
    const isInstalled = window.Android?.checkFileExists ? await window.Android.checkFileExists(BASE_PATH + moduleDirName) : false;
    const followIcon = getFollowIcon(module.follow);
    const followLink = module.follow ? `<a href="${module.follow}" target="_blank" class="text-gray-500 hover:text-white transition-colors text-sm ml-2">${followIcon}</a>` : '';
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
        <div class="flex-grow pr-4">
            <h3 class="font-bold text-gray-200 text-sm font-mono">${module.name}</h3>
            <p class="text-[10px] text-gray-500 font-mono mt-1 flex items-center">SYS_AUTH: ${module.credit}${followLink}</p>
        </div>
        <div id="action-container-${moduleDirName}" class="flex-shrink-0">${actionHtml}</div>
    `;
    container.appendChild(listItem);
}

function createInstalledActionsHtml(moduleDirName, moduleName) {
    const isChecked = moduleStates[moduleDirName] ? 'checked' : '';
    return `<div class="flex items-center gap-3"><label class="relative"><input type="checkbox" class="sr-only" onchange="toggleModule('${moduleDirName}', '${moduleName}', this)" ${isChecked}><div class="hw-switch"></div></label><button onclick="removeModule('${moduleDirName}', '${moduleName}')" class="btn-press text-gray-500 hover:text-red-500 text-sm w-8 h-8 flex items-center justify-center border border-sysBorder rounded-sm bg-black"><i class="fas fa-trash"></i></button></div>`;
}

function createDownloadHtml(moduleName, url) {
    return `<button onclick="downloadModule('${moduleName}', '${url}')" class="btn-press text-gray-300 hover:text-white text-sm w-8 h-8 flex items-center justify-center border border-sysBorder bg-[#1a0f0f] rounded-sm"><i class="fas fa-download text-accentRed"></i></button>`;
}

function getFollowIcon(url) {
    if (!url) return '';
    if (url.includes('youtube')) return '<i class="fab fa-youtube"></i>';
    if (url.includes('instagram')) return '<i class="fab fa-instagram"></i>';
    if (url.includes('tiktok')) return '<i class="fab fa-tiktok"></i>';
    return '<i class="fas fa-globe"></i>';
}

function downloadModule(moduleName, url) {
    if (!window.Android?.downloadZipModule) { getAlpine().showNotification("Native environment required."); return; }
    const alpine = getAlpine();
    alpine.activeModal = 'download';
    document.getElementById("modal-status").textContent = "INITIATING RX...";
    window.Android.downloadZipModule(url, moduleName);
}

window.downloadComplete = function(moduleName, success, fileName) {
    if (success) {
        document.getElementById("modal-status").textContent = "EXTRACTING...";
        if (window.Android?.unzipModule && fileName) {
            const moduleDirName = sanitizeName(moduleName);
            moduleZipMap[moduleDirName] = fileName;
            saveModuleZipMap();
            window.Android.unzipModule(fileName, moduleDirName);
        }
    } else {
        getAlpine().showNotification(`RX FAIL: ${moduleName}`);
        getAlpine().activeModal = '';
    }
};

window.unzipComplete = function(success, moduleDirName) {
    const alpine = getAlpine();
    if (alpine.activeModal === 'download') alpine.activeModal = '';
    if (success) {
        alpine.showNotification(`PKG DEPLOYED`);
        moduleStates[moduleDirName] = false;
        saveModuleStates();
        const actionContainer = document.getElementById(`action-container-${moduleDirName}`);
        if (actionContainer) {
            const moduleName = actionContainer.closest('.module-item').querySelector('h3').textContent;
            actionContainer.innerHTML = createInstalledActionsHtml(moduleDirName, moduleName);
        }
    } else {
        alpine.showNotification(`DEPLOY ERROR`);
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
    alpine.modalMessage = `EXECUTING SCRIPT...`;
    alpine.activeModal = 'processing';
    await new Promise(resolve => setTimeout(resolve, 150)); 
    
    const scriptType = isActivating ? 'install' : 'remove';
    const scriptName = await findModuleScript(moduleDirName, scriptType);
    if (!scriptName) {
        alpine.showNotification(`SCRIPT NOT FOUND`);
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
    const confirmed = await alpine.showConfirm(`Confirm deletion of ${moduleDisplayName}?`);
    if (!confirmed) return;
    
    alpine.modalMessage = `PURGING DATA...`;
    alpine.activeModal = 'processing';
    await new Promise(resolve => setTimeout(resolve, 150));
    
    const performDeletion = () => {
        const zipFileName = moduleZipMap[moduleDirName] || sanitizeName(moduleDisplayName) + ".zip";
        if (window.Android?.deleteModuleFiles) {
            window.Android.deleteModuleFiles(moduleDirName, zipFileName);
        } else {
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
        alpine.showNotification("PKG PURGED");
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
        alpine.showNotification("PURGE ERROR");
    }
};

window.onShellOutput = function(moduleName, output, logId) {
    const outEl = document.getElementById("cmd-output");
    if (window.currentLogId !== logId) {
        outEl.innerHTML = ''; window.currentOutput = ''; window.currentLogId = logId;
    }
    window.currentOutput += output + "\n";
    outEl.innerHTML += output + '\n';
    outEl.scrollTop = outEl.scrollHeight;
};

window.runComplete = function(moduleName, success, logId) {
    const alpine = getAlpine();
    alpine.activeModal = 'commandOutput';
    if (success) {
        alpine.showNotification(`EXEC OK`);
    } else {
        alpine.showNotification(`EXEC FAIL`);
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
            getAlpine().showNotification('INVALID FORMAT');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64String = e.target.result.split(',')[1];
            getAlpine().modalMessage = `DEPLOYING...`;
            getAlpine().activeModal = 'processing';
            
            setTimeout(() => {
                if(window.Android?.installLocalZipModule) {
                    window.Android.installLocalZipModule(file.name, base64String);
                }
            }, 150);
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
        alpine.showNotification('DEPLOY OK');
        const newModuleName = originalFileName.replace(".zip", "");
        const newModule = { name: newModuleName, credit: 'LOCAL', follow: '', url: '' };
        allModulesData.push(newModule);
        moduleZipMap[moduleDirName] = originalFileName;
        saveModuleZipMap();
        await renderSingleModule(newModule, document.getElementById('module-list-container'));
    } else {
        alpine.showNotification('DEPLOY FAIL');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadDatabase();
    setupEventListeners();
});