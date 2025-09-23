let pingInterval = null;

function initializeNetworkTab() {
    renderNetworkTweakComponents();
}

function renderNetworkTweakComponents() {
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

    createRadioOptions('network-profile-options', [
        { id: 'default', name: 'Default (Cubic)', value: 'restore_network_profile' },
        { id: 'gaming', name: 'Gaming (BBR)', value: 'network_profile_gaming' },
    ], 'network_profile');

    createRadioOptions('dns-options-container', [
        { id: 'default', name: 'Default DNS', value: 'restore_dns' },
        { id: 'google', name: 'Google DNS', value: 'set_dns_google' },
        { id: 'cloudflare', name: 'Cloudflare DNS', value: 'set_dns_cloudflare' },
    ], 'dns');
}


async function runPingCycle() {
    if (!COMMANDS.ping_realtime) return;
    const pingValueEl = document.getElementById('ping-value');
    const pingIconEl = document.getElementById('ping-status-icon');

    try {
        const output = await executeShellCommand(COMMANDS.ping_realtime, 'SilentOp', `ping-${generateRandomId()}`);
        const match = output.match(/time=([\d.]+)\s*ms/);
        
        if (match && match[1]) {
            const ping = Math.round(parseFloat(match[1]));
            pingValueEl.textContent = ping;
            if (ping < 50) {
                pingIconEl.className = 'fas fa-circle text-green-400';
            } else if (ping < 150) {
                pingIconEl.className = 'fas fa-circle text-yellow-400';
            } else {
                pingIconEl.className = 'fas fa-circle text-red-400';
            }
        } else {
            pingValueEl.textContent = 'N/A';
            pingIconEl.className = 'fas fa-circle text-gray-500';
        }
    } catch (e) {
        console.error('Ping cycle failed:', e);
        pingValueEl.textContent = 'FAIL';
        pingIconEl.className = 'fas fa-circle text-red-500';
    }
}

function startPingUpdates() {
    if (pingInterval) return;
    runPingCycle();
    pingInterval = setInterval(runPingCycle, 2000);
}

function stopPingUpdates() {
    clearInterval(pingInterval);
    pingInterval = null;
}