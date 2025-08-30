let realtimeUpdateInterval = null;
const cpuState = { prevIdle: 0, prevTotal: 0 };

async function checkDnsStatus() {
    try {
        const command = `mode=$(settings get global private_dns_mode); spec=$(settings get global private_dns_specifier); if [[ "$mode" == "hostname" && ("$spec" == *adguard* || "$spec" == *nextdns*) ]]; then echo "ADBLOCK_DNS_DETECTED"; else echo "OK"; fi`;
        const output = await executeShellCommand(command, 'DnsCheck', `dns-check-${generateRandomId()}`);
        if (output.trim() === "ADBLOCK_DNS_DETECTED") getAlpine().activeModal = 'dnsWarning';
    } catch (e) {
        console.error("DNS check failed:", e);
    }
}

async function initializeDashboard() {
    if (!(await checkShizukuStatus())) {
        document.getElementById('dashboard-loading').innerHTML = `<p class="text-yellow-400 text-sm"><i class="fas fa-exclamation-triangle mr-2"></i>Shizuku not running. Cannot fetch live data.</p>`;
        return;
    }
    const command = [
        "getprop ro.product.brand",
        "getprop ro.product.model",
        "getprop ro.product.cpu.abi",
        "getprop ro.build.version.sdk",
        "getprop ro.build.id",
        "[ $(su -c 'echo 1' 2>/dev/null) ] && echo 'Yes' || echo 'No'",
        "uptime -p"
    ].join(" && echo '---NEON_SPLIT---' && ");
    try {
        const output = await executeShellCommand(command, 'DeviceInfo', `static-${generateRandomId()}`);
        const parts = output.split('---NEON_SPLIT---\n');
        document.getElementById('device-name').textContent = `${parts[0] ?? '...'} ${parts[1] ?? '...'}`;
        document.getElementById('device-cpu-arch').textContent = parts[2] ?? '...';
        document.getElementById('device-sdk').textContent = parts[3] ?? '...';
        document.getElementById('device-build').textContent = parts[4] ?? '...';
        document.getElementById('device-root').textContent = parts[5] ?? '...';
        document.getElementById('device-uptime').textContent = (parts[6] ?? '...').replace('up ', '');
        document.getElementById('dashboard-loading').style.display = 'none';
        document.getElementById('dashboard-grid').style.display = 'grid';
        await updateRealtimeInfo();
        if (realtimeUpdateInterval) clearInterval(realtimeUpdateInterval);
        realtimeUpdateInterval = setInterval(updateRealtimeInfo, 2000);
    } catch (e) {
        console.error("Failed to initialize dashboard:", e);
        document.getElementById('dashboard-loading').innerHTML = `<p class="text-red-400 text-sm"><i class="fas fa-exclamation-circle mr-2"></i>Failed to load device info.</p>`;
    }
}

async function updateRealtimeInfo() {
    const command = [
        "cat /proc/meminfo",
        "head -n 1 /proc/stat",
        "dumpsys display | grep 'fps='",
        "dumpsys battery | grep -E 'level|status|temperature'"
    ].join(" && echo '---NEON_SPLIT---' && ");
    try {
        const output = await executeShellCommand(command, 'DeviceInfo', `realtime-${generateRandomId()}`);
        const parts = output.split('---NEON_SPLIT---\n');
        const memInfo = parts[0] ?? '';
        const memTotal = parseInt(memInfo.match(/MemTotal:\s+(\d+)/)?.[1] ?? 0),
            memAvailable = parseInt(memInfo.match(/MemAvailable:\s+(\d+)/)?.[1] ?? 0);
        if (memTotal > 0) {
            const memUsed = memTotal - memAvailable,
                formatRam = (kb) => (kb / 1024 / 1024).toFixed(2);
            document.getElementById('ram-used').textContent = formatRam(memUsed);
            document.getElementById('ram-total').textContent = formatRam(memTotal);
            document.getElementById('ram-percent').textContent = ((memUsed / memTotal) * 100).toFixed(0);
        }
        const cpuStat = (parts[1] ?? '').split(/\s+/).slice(1).map(Number);
        if (cpuStat.length > 3) {
            const idle = cpuStat[3],
                total = cpuStat.reduce((a, b) => a + b, 0);
            const diffIdle = idle - cpuState.prevIdle,
                diffTotal = total - cpuState.prevTotal;
            const usage = diffTotal > 0 ? Math.max(0, Math.min(100, Math.round(100 * (1 - diffIdle / diffTotal)))) : 0;
            cpuState.prevIdle = idle;
            cpuState.prevTotal = total;
            document.getElementById('cpu-percent').textContent = usage;
        }
        const fpsInfo = parts[2] ?? '';
        const fpsMatches = [...fpsInfo.matchAll(/fps=([\d.]+)/g)];
        document.getElementById('fps-value').textContent = fpsMatches.length > 0 ? Math.round(Math.max(...fpsMatches.map(m => parseFloat(m[1])))) : '--';
        const batteryInfo = parts[3] ?? '';
        document.getElementById('battery-level').textContent = batteryInfo.match(/level: (\d+)/)?.[1] ?? '--';
        document.getElementById('battery-temp').textContent = ((parseInt(batteryInfo.match(/temperature: (\d+)/)?.[1] ?? 0)) / 10).toFixed(1);
        document.getElementById('battery-status-icon').className = batteryInfo.match(/status: 2/)?.[0] ? 'fas fa-bolt charging' : 'fas fa-battery-three-quarters';
    } catch (e) {
        console.error("Failed to update real-time info:", e);
        clearInterval(realtimeUpdateInterval);
        getAlpine().showNotification("Lost connection for real-time data.");
    }
}