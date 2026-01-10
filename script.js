document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('urlInput');
    const convertBtn = document.getElementById('convertBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const resetBtn = document.getElementById('resetBtn');
    const pasteBtn = document.getElementById('pasteBtn');
    const clearBtn = document.getElementById('clearBtn');
    const statusDiv = document.getElementById('status');
    const progressBar = document.getElementById('progressBar');
    const progressFill = document.getElementById('progressFill');
    const downloadArea = document.getElementById('downloadArea');
    const downloadList = document.getElementById('downloadList');

    const BACKEND_URL = 'https://audio-converter-backend.onrender.com'; 

    let currentSessionId = null;
    let abortController = null;
    let progressInterval = null;

    // --- Helper Functions ---
    const resetUI = () => {
        convertBtn.disabled = false;
        cancelBtn.classList.add('hidden');
        resetBtn.classList.remove('hidden'); 
        progressBar.classList.add('hidden');
        currentSessionId = null;
        
        if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
        }
    };

    const fullReset = () => {
        urlInput.value = '';
        statusDiv.textContent = "Ready";
        downloadList.innerHTML = '';
        downloadArea.classList.add('hidden');
        resetUI();
    };

    const updateProgress = (current, total) => {
        const percent = Math.round((current / total) * 100);
        progressFill.style.width = percent + '%';
        progressFill.textContent = `${current}/${total} (${percent}%)`;
    };

    const pollProgress = async (sessionId) => {
        try {
            const response = await fetch(`${BACKEND_URL}/progress/${sessionId}`);
            if (response.ok) {
                const progress = await response.json();
                
                if (progress.status === "processing" && progress.total > 0) {
                    updateProgress(progress.current, progress.total);
                    statusDiv.innerHTML = `<div class="spinner"></div><p>Processing track ${progress.current} of ${progress.total}...</p>`;
                }
            }
        } catch (e) {
            console.error("Progress polling error:", e);
        }
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

        if (abortController) abortController.abort();

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

        currentSessionId = self.crypto.randomUUID();
        abortController = new AbortController();

        convertBtn.disabled = true;
        resetBtn.classList.add('hidden');
        cancelBtn.classList.remove('hidden');
        progressBar.classList.remove('hidden');
        progressFill.style.width = '0%';
        progressFill.textContent = '0/0 (0%)';
        
        statusDiv.innerHTML = `<div class="spinner"></div><p>Analyzing playlist...</p>`;
        downloadArea.classList.add('hidden');

        // Start polling progress every 2 seconds
        progressInterval = setInterval(() => pollProgress(currentSessionId), 2000);

        try {
            const response = await fetch(`${BACKEND_URL}/convert`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    url: url,
                    session_id: currentSessionId 
                }),
                signal: abortController.signal 
            });
            const result = await response.json();

            // Stop progress polling
            if (progressInterval) {
                clearInterval(progressInterval);
                progressInterval = null;
            }

            if (result.status === "success") {
                updateProgress(result.total_processed, result.total_expected);
                
                const processedCount = result.total_processed || result.tracks.length;
                const expectedCount = result.total_expected || result.tracks.length;
                
                statusDiv.innerHTML = `✅ ${processedCount} of ${expectedCount} track(s) ready.`;
                downloadArea.classList.remove('hidden');
                downloadList.innerHTML = ''; 

                if (result.zipLink) {
                    const zipA = document.createElement('a');
                    zipA.href = `${BACKEND_URL}${result.zipLink}`;
                    zipA.innerHTML = "<strong>📦 DOWNLOAD ALL (ZIP)</strong>";
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

                if (result.skipped && result.skipped.length > 0) {
                    const skipLi = document.createElement('li');
                    skipLi.innerHTML = "<strong style='color:#ef4444'>⚠️ Unavailable:</strong>";
                    downloadList.appendChild(skipLi);
                    result.skipped.forEach(s => {
                        const li = document.createElement('li');
                        li.textContent = `🚫 ${s}`;
                        li.style.cssText = "font-size:12px; color:#64748b; margin-left:10px;";
                        downloadList.appendChild(li);
                    });
                }
            } else if (result.status === "cancelled") {
                statusDiv.textContent = "Conversion stopped.";
            } else { 
                statusDiv.textContent = "Error: " + result.message; 
            }
        } catch (e) {
            if (e.name === 'AbortError') {
                console.log("Request was aborted.");
            } else {
                statusDiv.textContent = "Server error. Please try a smaller playlist or wait and try again.";
            }
        } finally { 
            resetUI();
        }
    });
});

function openModal(id) { document.getElementById(id).style.display = "flex"; }
function closeModal(id) { document.getElementById(id).style.display = "none"; }
window.onclick = (e) => { if (e.target.className === 'modal') e.target.style.display = "none"; };