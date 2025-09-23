async function loadAppVersion() {
    try {
        const version = window.Android?.getAppVersion ? await window.Android.getAppVersion() : "0.0.0";
        document.getElementById("app-version").textContent = `Version: ${version || 'Unknown'}`;
        return version;
    } catch (e) {
        console.error("Error loading app version:", e);
        document.getElementById("app-version").textContent = "Version: Error";
        return "0.0.0";
    }
}

function compareVersions(v1, v2) {
    const p1 = v1.split('.').map(Number);
    const p2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
        const n1 = p1[i] || 0;
        const n2 = p2[i] || 0;
        if (n1 > n2) return 1;
        if (n1 < n2) return -1;
    }
    return 0;
}

async function checkForUpdates() {
    try {
        const localVersion = await loadAppVersion();
        if (localVersion === "0.0.0") return;
        const response = await fetch(VERSION_URL, { cache: "no-store" });
        const data = await response.json();
        
        if (compareVersions(data.latestVersion, localVersion) > 0) {
            document.getElementById('update-version').textContent = data.latestVersion;
            
            const releaseNotesHTML = `<ul>${data.releaseNotes.map(note => `<li>${note}</li>`).join('')}</ul>`;
            document.getElementById('update-notes').innerHTML = releaseNotesHTML;
            
            document.getElementById('update-link').href = data.downloadUrl;
            
            // This ensures the static text parts are translated
            translateUI(); 

            getAlpine().activeModal = 'update';
        }
    } catch (e) {
        console.error("Update check failed:", e);
    }
}