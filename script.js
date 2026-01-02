document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('urlInput');
    const convertBtn = document.getElementById('convertBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const pasteBtn = document.getElementById('pasteBtn');
    const clearBtn = document.getElementById('clearBtn');
    const statusDiv = document.getElementById('status');
    const downloadArea = document.getElementById('downloadArea');
    const downloadList = document.getElementById('downloadList');

    const BACKEND_URL = 'https://audio-converter-backend.onrender.com'; 

    // State management for cancellation
    let currentSessionId = null;
    let abortController = null;

    pasteBtn.addEventListener('click', async () => {
        try {
            urlInput.value = await navigator.clipboard.readText();
        } catch (err) { alert("Please paste manually."); }
    });

    clearBtn.addEventListener('click', () => {
        downloadList.innerHTML = '';
        downloadArea.classList.add('hidden');
        urlInput.value = '';
        statusDiv.textContent = "Ready";
    });

    // --- CANCEL BUTTON LOGIC ---
    cancelBtn.addEventListener('click', async () => {
        if (!currentSessionId) return;

        // 1. Kill browser request
        if (abortController) abortController.abort();

        // 2. Notify backend to kill process
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

    function resetUI() {
        convertBtn.disabled = false;
        cancelBtn.classList.add('hidden'); 
        currentSessionId = null;
    }

    convertBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) return;

        // Setup session and abort controller
        currentSessionId = self.crypto.randomUUID();
        abortController = new AbortController();

        convertBtn.disabled = true;
        cancelBtn.classList.remove('hidden'); 
        statusDiv.innerHTML = `<div class="spinner"></div><p>Converting tracks...</p>`;
        downloadArea.classList.add('hidden');

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

            if (result.status === "success") {
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
                console.log("Fetch aborted");
            } else {
                statusDiv.textContent = "Server error.";
            }
        } finally { 
            resetUI();
        }
    });
});

/** * Modal Logic - Defined outside the DOMContentLoaded listener 
 * so they are globally accessible to the HTML onclick attributes.
 */
function openModal(id) { 
    const modal = document.getElementById(id);
    if (modal) modal.style.display = "flex"; 
}

function closeModal(id) { 
    const modal = document.getElementById(id);
    if (modal) modal.style.display = "none"; 
}

// Close modal when clicking outside the content area
window.onclick = (e) => { 
    if (e.target.className === 'modal') {
        e.target.style.display = "none"; 
    }
};