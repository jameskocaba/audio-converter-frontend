document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('urlInput');
    const convertBtn = document.getElementById('convertBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const resetBtn = document.getElementById('resetBtn');
    const pasteBtn = document.getElementById('pasteBtn');
    const clearBtn = document.getElementById('clearBtn');
    const statusDiv = document.getElementById('status');
    const downloadArea = document.getElementById('downloadArea');
    const downloadList = document.getElementById('downloadList');

    const BACKEND_URL = 'https://audio-converter-backend.onrender.com'; 

    let currentSessionId = null;
    let pollInterval = null;

    // --- Helper Functions ---
    const resetUI = () => {
        convertBtn.disabled = false;
        cancelBtn.classList.add('hidden');
        resetBtn.classList.remove('hidden'); 
        if (pollInterval) clearInterval(pollInterval);
    };

    const fullReset = () => {
        urlInput.value = '';
        statusDiv.textContent = "Ready";
        downloadList.innerHTML = '';
        downloadArea.classList.add('hidden');
        resetUI();
    };

    const renderResults = (result) => {
        statusDiv.innerHTML = `✅ ${result.tracks.length} track(s) ready.`;
        downloadArea.classList.remove('hidden');
        downloadList.innerHTML = ''; 

        if (result.zipLink) {
            const zipA = document.createElement('a');
            zipA.href = `${BACKEND_URL}${result.zipLink}`;
            zipA.innerHTML = "<strong>DOWNLOAD ALL (ZIP)</strong>";
            zipA.className = "zip-btn";
            downloadList.appendChild(zipA);
        }

        result.tracks.forEach(t => {
            const a = document.createElement('a');
            a.href = `${BACKEND_URL}${t.downloadLink}`;
            a.textContent = `⬇️ ${t.name}`;
            a.className = "track-btn";
            downloadList.appendChild(a);
        });
    };

    // --- Event Listeners ---
    pasteBtn.addEventListener('click', async () => {
        try {
            urlInput.value = await navigator.clipboard.readText();
        } catch (err) { alert("Please paste manually."); }
    });

    clearBtn.addEventListener('click', () => {
        downloadList.innerHTML = '';
        downloadArea.classList.add('hidden');
        statusDiv.textContent = "Ready";
    });

    resetBtn.addEventListener('click', fullReset);

    cancelBtn.addEventListener('click', async () => {
        if (!currentSessionId) return;
        clearInterval(pollInterval);

        try {
            statusDiv.innerHTML = "Stopping...";
            await fetch(`${BACKEND_URL}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: currentSessionId }),
            });
        } catch (e) { console.error("Cancel notify error", e); }

        statusDiv.textContent = "Conversion cancelled.";
        resetUI();
    });

    convertBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) return;

        convertBtn.disabled = true;
        resetBtn.classList.add('hidden');
        cancelBtn.classList.remove('hidden');
        
        statusDiv.innerHTML = `<div class="spinner"></div><p>Initializing connection...</p>`;
        downloadArea.classList.add('hidden');

        try {
            // 1. Tell server to start (Returns immediately)
            const response = await fetch(`${BACKEND_URL}/convert`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url })
            });
            
            const startData = await response.json();
            currentSessionId = startData.session_id;

            if (startData.status === "started") {
                // 2. Start Polling for status
                pollInterval = setInterval(async () => {
                    try {
                        const statusRes = await fetch(`${BACKEND_URL}/status/${currentSessionId}`);
                        const result = await statusRes.json();

                        if (result.status === "processing") {
                            statusDiv.innerHTML = `<div class="spinner"></div><p>Downloaded ${result.count || 0} tracks...</p>`;
                        } 
                        else if (result.status === "completed") {
                            clearInterval(pollInterval);
                            renderResults(result);
                            resetUI();
                        } 
                        else if (result.status === "error") {
                            clearInterval(pollInterval);
                            statusDiv.textContent = "Error: " + result.message;
                            resetUI();
                        }
                    } catch (pollErr) {
                        console.error("Polling error", pollErr);
                    }
                }, 3000); // Check every 3 seconds

            } else {
                statusDiv.textContent = "Error: " + startData.message;
                resetUI();
            }
        } catch (e) {
            statusDiv.textContent = "Server connection failed.";
            resetUI();
        }
    });
});

function openModal(id) { document.getElementById(id).style.display = "flex"; }
function closeModal(id) { document.getElementById(id).style.display = "none"; }
window.onclick = (e) => { if (e.target.className === 'modal') e.target.style.display = "none"; };