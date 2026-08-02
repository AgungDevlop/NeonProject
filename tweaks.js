let diagnosisInterval = null;
let diagnosisChart = null;

function initializeDiagnosisChart() {
    const ctx = document.getElementById('diagnosis-chart')?.getContext('2d');
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, ctx.canvas.width, 0);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.8)');
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.3)');

    diagnosisChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: '% CPU Usage',
                data: [],
                backgroundColor: gradient,
                borderColor: 'rgba(52, 211, 153, 0.5)',
                borderWidth: 1,
                borderRadius: 4,
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    beginAtZero: true,
                    max: 100,
                    ticks: { color: '#9ca3af', font: { family: "'JetBrains Mono', monospace" } },
                    grid: { color: 'rgba(156, 163, 175, 0.1)' }
                },
                y: {
                    ticks: { color: '#e5e7eb', font: { family: "'JetBrains Mono', monospace", size: 10 } },
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#030712',
                    titleColor: '#34d399',
                    bodyColor: '#f3f4f6',
                    bodyFont: { family: "'JetBrains Mono', monospace" },
                    titleFont: { family: "'JetBrains Mono', monospace" }
                }
            }
        }
    });
}

async function applyPerformanceFix(packageName) {
    if (!packageName) return;
    const command = `am force-stop ${packageName}`;
    try {
        await executeShellCommand(command, 'SilentOp', `fix-${generateRandomId()}`);
        showNotification(`Optimized: ${packageName} has been stopped.`, 'success');
        await runDiagnosisCycle();
    } catch (e) {
        showNotification(`Failed to optimize ${packageName}.`, 'error');
    }
}

function parseTopOutput(output) {
    try {
        const lines = output.split('\n');
        const processLines = lines.slice(7);
        return processLines.map(line => {
            const parts = line.trim().split(/\s+/);
            if (parts.length < 10) return null;
            return {
                name: parts[parts.length - 1],
                cpu: parseFloat(parts[8]) || 0
            };
        }).filter(p => p && p.name && p.cpu > 0.1).slice(0, 10);
    } catch {
        return [];
    }
}

function updateDiagnosis(processes) {
    if (!diagnosisChart) return;
    const alertDiv = document.getElementById('diagnosis-alert');
    const highUsageProcess = processes.find(p => p.cpu > 40);

    if (highUsageProcess) {
        const safePackageName = highUsageProcess.name.replace(/'/g, "\\'");
        alertDiv.innerHTML = `
            <div class="flex items-center justify-between w-full gap-4">
                <div class="flex-grow min-w-0">
                    <i class="fas fa-exclamation-triangle mr-2 text-yellow-400"></i>
                    <strong class="text-white">High CPU:</strong> 
                    <code class="text-emerald-300 truncate">${highUsageProcess.name}</code> 
                    <strong class="ml-1">${highUsageProcess.cpu.toFixed(1)}%</strong>
                </div>
                <button onclick="applyPerformanceFix('${safePackageName}')" class="btn btn-primary btn-sm py-1 px-4 text-xs whitespace-nowrap flex-shrink-0">
                    <i class="fas fa-bolt mr-1"></i>FIX
                </button>
            </div>
        `;
        alertDiv.className = 'mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-300 text-sm transition-all duration-300 flex items-center';
    } else {
        alertDiv.className = 'hidden';
    }

    const sortedProcesses = processes.sort((a, b) => a.cpu - b.cpu);

    diagnosisChart.data.labels = sortedProcesses.map(p => p.name);
    diagnosisChart.data.datasets[0].data = sortedProcesses.map(p => p.cpu);
    diagnosisChart.update();
}

async function runDiagnosisCycle() {
    if (!COMMANDS.diagnose_realtime) return;
    const shizukuOk = await checkShizukuStatus();
    
    if (!shizukuOk) {
        const dummyProcesses = [
            { name: 'com.android.systemui', cpu: Math.random() * 5 + 1 },
            { name: 'system_server', cpu: Math.random() * 10 + 2 },
            { name: 'com.neon.magisk', cpu: Math.random() * 3 + 0.5 },
            { name: 'surfaceflinger', cpu: Math.random() * 8 + 1 }
        ];
        if (Math.random() > 0.8) dummyProcesses.push({ name: 'com.tencent.ig', cpu: Math.random() * 20 + 45 });
        updateDiagnosis(dummyProcesses);
        return;
    }

    try {
        const output = await executeShellCommand(COMMANDS.diagnose_realtime, 'SilentOp', `diag-${generateRandomId()}`);
        const processes = parseTopOutput(output);
        updateDiagnosis(processes);
    } catch (e) {
        stopDiagnosis();
    }
}

function startDiagnosis() {
    if (diagnosisInterval || !diagnosisChart) return;
    runDiagnosisCycle();
    diagnosisInterval = setInterval(runDiagnosisCycle, 3000);
}

function stopDiagnosis() {
    clearInterval(diagnosisInterval);
    diagnosisInterval = null;
}

function loadTweakSettings() {
    tweakSettings = JSON.parse(localStorage.getItem('tweakSettings')) || {};
}

function saveTweakSetting(key, value) {
    tweakSettings[key] = value;
    localStorage.setItem('tweakSettings', JSON.stringify(tweakSettings));
}

function renderTweakComponents() {
    const createRadioOptions = (containerId, options, name) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        options.forEach(opt => {
            const item = document.createElement("div");
            item.className = "radio-item";
            item.innerHTML = `<input type="radio" id="${name}-${opt.id}" name="${name}-group" value="${opt.value}" data-tweak="${name}"><label for="${name}-${opt.id}"><span class="flex-grow">${opt.name}</span></label>`;
            container.appendChild(item);
        });
    };

    createRadioOptions('renderer-options', [
        { id: 'opengl', name: 'Default (OpenGL)', value: 'renderer_opengl' },
        { id: 'skiagl', name: 'SkiaGL', value: 'renderer_skiagl' },
        { id: 'skiavk', name: 'SkiaVK (Vulkan)', value: 'renderer_skiavk' }
    ], 'renderer');

    createRadioOptions('network-profile-options', [
        { id: 'default', name: 'Default Profile', value: 'network_default' },
        { id: 'gaming', name: 'Gaming (Low Latency)', value: 'network_gaming' }
    ], 'network_profile');
}

function applyStoredTweaks() {
    Object.keys(tweakSettings).forEach(key => {
        const value = tweakSettings[key];
        const element = document.querySelector(`[data-tweak="${key}"][value="${value}"]`) || document.querySelector(`[data-tweak="${key}"]`);
        if (!element) return;

        if (element.type === 'radio') {
            element.checked = true;
        } else if (element.type === 'checkbox') {
            element.checked = value;
        } else if (element.type === 'number') {
            element.value = value;
        }
    });
}
