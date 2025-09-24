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
        <div class="flex border-b border-gray-700 mb-4">
            <button class="builder-tab-btn active" data-target="battleground-settings">
                <i class="fas fa-chess-knight mr-2"></i><span data-lang-key="builder_battleground_title"></span>
            </button>
            <button class="builder-tab-btn" data-target="battleroyale-settings">
                <i class="fas fa-crosshairs mr-2"></i><span data-lang-key="builder_battleroyale_title"></span>
            </button>
        </div>
    `;

    let content = '';
    for (const genre in builderConfig) {
        const config = builderConfig[genre];
        content += `<div id="${genre}-settings" class="builder-pane space-y-6 ${genre === 'battleground' ? 'active' : ''}">`;

        config.settings.forEach(tweak => {
            const nameKey = tweak.nameKey;
            const descKey = tweak.descKey;

            content += '<div class="tweak-item-full">';
            if (tweak.type === 'checkbox') {
                content += `<div class="tweak-item"><span class="tweak-label" data-lang-key="${nameKey}"></span> <button class="tooltip-btn"><i class="fas fa-question-circle"></i></button> <label class="switch"><input type="checkbox" class="builder-input" data-command="${tweak.command}"><span class="slider"></span></label></div><p class="tweak-description hidden" data-lang-key="${descKey}"></p>`;
            } else if (tweak.type === 'radio') {
                content += `<h3 class="input-label flex items-center gap-2" data-lang-key="${nameKey}"></h3>`;
                tweak.options.forEach((opt, index) => {
                    content += `<div class="radio-item mb-2"><input type="radio" id="${tweak.tweakKey}-${index}" name="${tweak.tweakKey}" class="builder-input" data-command="${opt.command}" ${index === 0 ? 'checked' : ''}><label for="${tweak.tweakKey}-${index}">${opt.name}</label></div>`;
                });
                content += `<p class="tweak-description hidden" data-lang-key="${descKey}"></p>`;
            } else if (tweak.type === 'range') {
                content += `<div class="slider-container"><label for="${tweak.tweakKey}" class="input-label flex items-center gap-2" data-lang-key="${nameKey}"></label><input id="${tweak.tweakKey}" type="range" min="${tweak.min}" max="${tweak.max}" step="${tweak.step}" value="${tweak.default}" class="builder-input slider-track" data-command-template="${tweak.commandTemplate}"><span id="${tweak.tweakKey}-value" class="slider-value">${tweak.default}</span></div><p class="tweak-description hidden" data-lang-key="${descKey}"></p>`;
            }
            content += '</div>';
        });

        content += '</div>';
    }

    container.innerHTML = tabs + content;
    translateUI();
}

function attachBuilderEventListeners() {
    const container = document.getElementById('module-builder-container');
    if (!container) return;

    container.querySelectorAll('.builder-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            container.querySelectorAll('.builder-tab-btn').forEach(b => b.classList.remove('active'));
            container.querySelectorAll('.builder-pane').forEach(p => p.classList.remove('active'));
            e.currentTarget.classList.add('active');
            const targetPane = document.getElementById(e.currentTarget.dataset.target);
            if (targetPane) {
                targetPane.classList.add('active');
            }
        });
    });

    container.querySelectorAll('.tooltip-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const description = e.currentTarget.parentElement.nextElementSibling;
            if (description && description.classList.contains('tweak-description')) {
                description.classList.toggle('hidden');
            }
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
    const activePane = document.querySelector('.builder-pane.active');
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
        const genreTitle = getLangString(builderConfig[genre].titleKey);
        runCommandFlow(finalCommand, getLangString('builder_notification_title', { genre: genreTitle }));
        getAlpine().showNotification(getLangString('notification_builder_applied', { genre: genreTitle }));
    } else {
        getAlpine().showNotification(getLangString('notification_builder_no_changes'));
    }
}