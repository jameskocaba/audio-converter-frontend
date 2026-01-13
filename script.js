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
    let isConverting = false;

    // --- Helper Functions ---
    const resetUI = () => {
        convertBtn.disabled = false;
        cancelBtn.classList.add('hidden');
        progressBar.classList.add('hidden');
        currentSessionId = null;
        isConverting = false;
        
        // Show reset button if there are downloads, otherwise hide it
        if (downloadList.children.length > 0) {
            resetBtn.classList.remove('hidden');
        } else {
            resetBtn.classList.add('hidden');
        }
    };

    const fullReset = () => {
        urlInput.value = '';
        statusDiv.textContent = "Ready";
        downloadList.innerHTML = '';
        downloadArea.classList.add('hidden');
        progressBar.classList.add('hidden');
        progressFill.style.width = '0%';
        progressFill.textContent = '0/0 (0%)';
        convertBtn.disabled = false;
        cancelBtn.classList.add('hidden');
        resetBtn.classList.add('hidden');
        currentSessionId = null;
        isConverting = false;
    };

    const updateProgress = (current, total) => {
        const percent = total > 0 ? Math.round((current / total) * 100) : 0;
        progressFill.style.width = percent + '%';
        progressFill.textContent = `${current}/${total} (${percent}%)`;
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
        // Hide reset button when clearing downloads
        if (!isConverting) {
            resetBtn.classList.add('hidden');
        }
    });

    resetBtn.addEventListener('click', fullReset);

    cancelBtn.addEventListener('click', async () => {
        if (!currentSessionId) return;

        try {
            statusDiv.innerHTML = "Stopping...";
            await fetch(`${BACKEND_URL}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: currentSessionId }),
                keepalive: true 
            });
        } catch (e) { console.error("Cancel notify error", e); }

        statusDiv.textContent = "Conversion cancelled.";
        resetUI();
    });

    convertBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) return;

        currentSessionId = self.crypto.randomUUID();
        isConverting = true;

        convertBtn.disabled = true;
        resetBtn.classList.add('hidden');
        cancelBtn.classList.remove('hidden');
        progressBar.classList.remove('hidden');
        progressFill.style.width = '0%';
        progressFill.textContent = '0/0 (0%)';
        
        statusDiv.innerHTML = `<div class="spinner"></div><p>Starting conversion...</p>`;
        downloadArea.classList.add('hidden');

        try {
            const response = await fetch(`${BACKEND_URL}/convert`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    url: url,
                    session_id: currentSessionId 
                }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || `HTTP Error ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop(); 

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            
                            switch (data.type) {
                                case 'status':
                                    statusDiv.innerHTML = `<div class="spinner"></div><p>${data.message}</p>`;
                                    break;
                                    
                                case 'total':
                                    updateProgress(0, data.total);
                                    statusDiv.innerHTML = `<div class="spinner"></div><p>Found ${data.total} tracks. Starting...</p>`;
                                    break;
                                    
                                case 'progress':
                                    updateProgress(data.current, data.total);
                                    statusDiv.innerHTML = `<div class="spinner"></div><p>Processing: ${data.track} (${data.current}/${data.total})</p>`;
                                    break;
                                    
                                case 'done':
                                    updateProgress(data.total_processed, data.total_expected);
                                    statusDiv.innerHTML = `✅ ${data.total_processed} of ${data.total_expected} item(s) ready.`;
                                    downloadArea.classList.remove('hidden');
                                    downloadList.innerHTML = ''; 

                                    if (data.zipLink) {
                                        const zipA = document.createElement('a');
                                        zipA.href = `${BACKEND_URL}${data.zipLink}`;
                                        zipA.innerHTML = "<strong>📦 DOWNLOAD ALL (ZIP)</strong>";
                                        zipA.className = "zip-btn";
                                        downloadList.appendChild(zipA);
                                    }

                                    // Only show individual tracks if they exist in the response
                                    if (data.tracks && data.tracks.length > 0) {
                                        data.tracks.forEach(t => {
                                            const a = document.createElement('a');
                                            a.href = `${BACKEND_URL}${t.downloadLink}`;
                                            const icon = t.name.toLowerCase().endsWith('.mp3') ? '⬇️' : '🖼️';
                                            a.textContent = `${icon} ${t.name}`;
                                            a.className = "track-btn";
                                            downloadList.appendChild(a);
                                        });
                                    }

                                    if (data.skipped && data.skipped.length > 0) {
                                        const skipLi = document.createElement('li');
                                        skipLi.innerHTML = "<strong style='color:#ef4444'>⚠️ Unavailable:</strong>";
                                        downloadList.appendChild(skipLi);
                                        data.skipped.forEach(s => {
                                            const li = document.createElement('li');
                                            li.textContent = `🚫 ${s}`;
                                            li.style.cssText = "font-size:12px; color:#64748b; margin-left:10px;";
                                            downloadList.appendChild(li);
                                        });
                                    }
                                    break;
                                    
                                case 'cancelled':
                                    statusDiv.textContent = "Conversion stopped.";
                                    break;
                                    
                                case 'error':
                                    statusDiv.textContent = "Error: " + data.message;
                                    break;
                            }
                        } catch (parseError) {
                            console.warn("JSON Parse Error on line:", line);
                        }
                    }
                }
            }
        } catch (e) {
            console.error("Streaming error:", e);
            if (e.name === 'AbortError') {
                statusDiv.textContent = "Request timed out. Please try again.";
            } else {
                statusDiv.textContent = `Connection Error: ${e.message}`;
            }
        } finally { 
            resetUI();
        }
    });
});

/**
 * --- GLOBAL MODAL FUNCTIONS ---
 * These are placed outside the DOMContentLoaded listener so the 
 * onclick attributes in the HTML can access them.
 */

function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = "flex";
        document.body.style.overflow = "hidden";
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = "none";
        document.body.style.overflow = "auto";
    }
}

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = "none";
        document.body.style.overflow = "auto";
    }
};