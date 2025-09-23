let diagnosisInterval = null, diagnosisChart = null;
function initializeDiagnosisChart() {
    const ctx = document.getElementById('diagnosis-chart')?.getContext('2d'); if (!ctx) return;
    diagnosisChart = new Chart(ctx, { type: 'bar', data: { labels: [], datasets: [{ label: '% CPU Usage', data: [], backgroundColor: 'rgba(16, 185, 129, 0.5)', borderColor: 'rgba(16, 185, 129, 1)', borderWidth: 1 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, scales: { x: { beginAtZero: true, max: 100, ticks: { color: '#9ca3af' }, grid: { color: 'rgba(156, 163, 175, 0.1)' } }, y: { ticks: { color: '#9ca3af' }, grid: { display: false } } }, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#030712', titleColor: '#34d399', bodyColor: '#f3f4f6' } } } });
}
function parseTopOutput(output) { try { const lines = output.split('\n'); const processLines = lines.slice(7); return processLines.map(line => { const parts = line.trim().split(/\s+/); if (parts.length < 10) return null; return { name: parts[parts.length - 1], cpu: parseFloat(parts[8]) || 0 }; }).filter(p => p && p.name && p.cpu > 0.1).slice(0, 10); } catch { return []; } }
function updateDiagnosis(processes) {
    const alertDiv = document.getElementById('diagnosis-alert'); const highUsageProcess = processes.find(p => p.cpu > 40);
    if (highUsageProcess) { alertDiv.innerHTML = `<i class="fas fa-exclamation-triangle mr-2"></i><strong>High CPU Usage:</strong> <code>${highUsageProcess.name}</code> at <strong>${highUsageProcess.cpu.toFixed(1)}% CPU</strong> may cause slowdowns.`; alertDiv.className = 'diagnosis-alert'; } else { alertDiv.className = 'hidden'; }
    diagnosisChart.data.labels = processes.map(p => p.name); diagnosisChart.data.datasets[0].data = processes.map(p => p.cpu); diagnosisChart.update();
}
async function runDiagnosisCycle() { if (!COMMANDS.diagnose_realtime) return; try { const output = await executeShellCommand(COMMANDS.diagnose_realtime, 'SilentOp', `diag-${generateRandomId()}`); const processes = parseTopOutput(output); updateDiagnosis(processes); } catch (e) { console.error('Diagnosis cycle failed:', e); stopDiagnosis(); } }
function startDiagnosis() { if (diagnosisInterval || !diagnosisChart) return; runDiagnosisCycle(); diagnosisInterval = setInterval(runDiagnosisCycle, 3000); }
function stopDiagnosis() { clearInterval(diagnosisInterval); diagnosisInterval = null; }
function loadTweakSettings() { tweakSettings = JSON.parse(localStorage.getItem('tweakSettings')) || {}; }
function saveTweakSetting(key, value) { tweakSettings[key] = value; localStorage.setItem('tweakSettings', JSON.stringify(tweakSettings)); }
function renderTweakComponents() {
    const createRadioOptions = (containerId, options, name) => {
        const container = document.getElementById(containerId); if (!container) return; container.innerHTML = '';
        options.forEach(opt => { const item = document.createElement("div"); item.className = "radio-item"; item.innerHTML = `<input type="radio" id="${name}-${opt.id}" name="${name}-group" value="${opt.value}" data-tweak="${name}"><label for="${name}-${opt.id}"><span class="flex-grow">${opt.name}</span></label>`; container.appendChild(item); });
    };
    createRadioOptions('renderer-options', [ { id: 'opengl', name: 'Default (OpenGL)', value: 'renderer_opengl' }, { id: 'skiagl', name: 'SkiaGL', value: 'renderer_skiagl' }, { id: 'skiavk', name: 'SkiaVK (Vulkan)', value: 'renderer_skiavk' } ], 'renderer');
    createRadioOptions('network-profile-options', [ { id: 'default', name: 'Default Profile', value: 'network_default' }, { id: 'gaming', name: 'Gaming (Low Latency)', value: 'network_gaming' } ], 'network_profile');
}
function applyStoredTweaks() {
    Object.keys(tweakSettings).forEach(key => {
        const value = tweakSettings[key]; const element = document.querySelector(`[data-tweak="${key}"][value="${value}"]`) || document.querySelector(`[data-tweak="${key}"]`); if (!element) return;
        if (element.type === 'radio') { element.checked = true; } else if (element.type === 'checkbox') { element.checked = value; } else if (element.type === 'number') { element.value = value; }
    });
}