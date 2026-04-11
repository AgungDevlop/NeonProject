let builderConfig = null;

async function initializeBuilder() {
    builderConfig = await loadData("cachedBuilderConfig", "builder.json", "module-builder-container");
    if (builderConfig) {
        await renderBuilderUI();
        attachBuilderEventListeners();
    }
}

async function renderBuilderUI() {
    const container = document.getElementById('module-builder-container');
    if (!container || !builderConfig) return;

    const tabs = `
        <div class="flex border-b border-sysBorder mb-4 gap-2">
            <button class="builder-tab-btn active flex-1 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b-2 border-transparent transition-colors" data-target="battleground-settings">
                <i class="fas fa-chess-knight mr-2"></i>Battleground
            </button>
            <button class="builder-tab-btn flex-1 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b-2 border-transparent transition-colors" data-target="battleroyale-settings">
                <i class="fas fa-crosshairs mr-2"></i>Battle Royale
            </button>
        </div>
    `;

    let content = '';
    for (const genre in builderConfig) {
        const config = builderConfig[genre];
        content += `<div id="${genre}-settings" class="builder-pane space-y-4 ${genre === 'battleground' ? 'block' : 'hidden'}">`;

        config.settings.forEach(tweak => {
            content += '<div class="bg-black border border-sysBorder p-3 rounded-sm">';
            if (tweak.type === 'checkbox') {
                content += `<div class="flex justify-between items-center mb-1"><span class="text-[10px] font-bold text-gray-200 uppercase tracking-widest">${tweak.nameKey}</span><label class="relative"><input type="checkbox" class="builder-input sr-only peer" data-command="${tweak.command}"><div class="hw-switch"></div></label></div><p class="text-[9px] text-gray-500 font-mono">${tweak.descKey}</p>`;
            } else if (tweak.type === 'radio') {
                content += `<h3 class="text-[10px] font-bold text-gray-200 uppercase tracking-widest mb-2">${tweak.nameKey}</h3><div class="space-y-2">`;
                tweak.options.forEach((opt, index) => {
                    content += `<div class="flex items-center gap-2"><input type="radio" id="${tweak.tweakKey}-${index}" name="${tweak.tweakKey}" class="builder-input" data-command="${opt.command}" ${index === 0 ? 'checked' : ''}><label for="${tweak.tweakKey}-${index}" class="text-[10px] font-mono text-gray-400">${opt.name}</label></div>`;
                });
                content += `</div><p class="text-[9px] text-gray-500 font-mono mt-2">${tweak.descKey}</p>`;
            } else if (tweak.type === 'range') {
                content += `<div class="flex flex-col gap-2"><label for="${tweak.tweakKey}" class="text-[10px] font-bold text-gray-200 uppercase tracking-widest flex justify-between">${tweak.nameKey} <span id="${tweak.tweakKey}-value" class="text-accentRed">${tweak.default}</span></label><input id="${tweak.tweakKey}" type="range" min="${tweak.min}" max="${tweak.max}" step="${tweak.step}" value="${tweak.default}" class="builder-input w-full accent-accentRed bg-sysBg" data-command-template="${tweak.commandTemplate}"></div><p class="text-[9px] text-gray-500 font-mono mt-1">${tweak.descKey}</p>`;
            }
            content += '</div>';
        });

        content += '</div>';
    }

    container.innerHTML = tabs + content;
}

function attachBuilderEventListeners() {
    const container = document.getElementById('module-builder-container');
    if (!container) return;

    container.querySelectorAll('.builder-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            container.querySelectorAll('.builder-tab-btn').forEach(b => { b.classList.remove('active', 'text-accentRed', 'border-accentRed'); b.classList.add('text-gray-500', 'border-transparent'); });
            container.querySelectorAll('.builder-pane').forEach(p => p.classList.add('hidden'));
            
            const target = e.currentTarget;
            target.classList.remove('text-gray-500', 'border-transparent');
            target.classList.add('active', 'text-accentRed', 'border-accentRed');
            
            const targetPane = document.getElementById(target.dataset.target);
            if (targetPane) targetPane.classList.remove('hidden');
        });
    });
    
    container.querySelectorAll('.builder-input[type="range"]').forEach(slider => {
        const valueDisplay = document.getElementById(`${slider.id}-value`);
        if (valueDisplay) {
            slider.addEventListener('input', () => { valueDisplay.textContent = slider.value; });
        }
    });

    document.getElementById('apply-builder-settings-btn')?.addEventListener('click', applyGeneratedSettings);
}

function applyGeneratedSettings() {
    const activePane = Array.from(document.querySelectorAll('.builder-pane')).find(p => !p.classList.contains('hidden'));
    if (!activePane) return;
    
    const genre = activePane.id.replace('-settings', '');
    const commands = [];
    const inputs = activePane.querySelectorAll('.builder-input');

    inputs.forEach(input => {
        const commandKey = input.dataset.command;
        const commandTemplate = input.dataset.commandTemplate;

        if (input.type === 'checkbox' && input.checked && commandKey && COMMANDS[commandKey]) {
            commands.push(COMMANDS[commandKey]);
        } else if (input.type === 'radio' && input.checked && commandKey && COMMANDS[commandKey]) {
            commands.push(COMMANDS[commandKey]);
        } else if (input.type === 'range' && commandTemplate) {
            commands.push(commandTemplate.replace(/{value}/g, input.value));
        }
    });

    if (commands.length > 0) {
        const finalCommand = commands.join(' && ');
        runCommandFlow(finalCommand, `Compile ${genre}`);
        getAlpine().showNotification(`Configuration pushed to target.`);
    } else {
        getAlpine().showNotification(`No parameters modified.`);
    }
}
