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
    let eventSource = null;

    // --- Helper Functions ---
    const resetUI = () => {
        convertBtn.disabled = false;
        cancelBtn.classList.add('hidden');
        resetBtn.classList.remove('hidden'); 
        progressBar.classList.add('hidden');
        currentSessionId = null;
        
        if (eventSource) {
            eventSource.close();
            eventSource = null;
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

        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }

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

        convertBtn.disabled = true;
        resetBtn.classList.add('hidden');
        cancelBtn.classList.remove('hidden');
        progressBar.classList.remove('hidden');
        progressFill.style.width = '0%';
        progressFill.textContent = '0/0 (0%)';
        
        statusDiv.innerHTML = `<div class="spinner"></div><p>Starting conversion...</p>`;
        downloadArea.classList.add('hidden');

        // Create EventSource for SSE
        const eventSourceUrl = `${BACKEND_URL}/convert`;
        
        // Use fetch with streaming for POST
        try {
            const response = await fetch(eventSourceUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    url: url,
                    session_id: currentSessionId 
                }),
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop(); // Keep incomplete line in buffer

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = JSON.parse(line.slice(6));
                        
                        switch (data.type) {
                            case 'status':
                                statusDiv.innerHTML = `<div class="spinner"></div><p>${data.message}</p>`;
                                break;
                                
                            case 'total':
                                updateProgress(0, data.total);
                                statusDiv.innerHTML = `<div class="spinner"></div><p>Found ${data.total} tracks. Starting conversion...</p>`;
                                break;
                                
                            case 'progress':
                                updateProgress(data.current, data.total);
                                statusDiv.innerHTML = `<div class="spinner"></div><p>Processing: ${data.track} (${data.current}/${data.total})</p>`;
                                break;
                                
                            case 'complete':
                                console.log(`✅ Completed: ${data.track}`);
                                break;
                                
                            case 'failed':
                                console.log(`❌ Failed: ${data.track}`);
                                break;
                                
                            case 'done':
                                // Final result
                                updateProgress(data.total_processed, data.total_expected);
                                
                                statusDiv.innerHTML = `✅ ${data.total_processed} of ${data.total_expected} track(s) ready.`;
                                downloadArea.classList.remove('hidden');
                                downloadList.innerHTML = ''; 

                                if (data.zipLink) {
                                    const zipA = document.createElement('a');
                                    zipA.href = `${BACKEND_URL}${data.zipLink}`;
                                    zipA.innerHTML = "<strong>📦 DOWNLOAD ALL (ZIP)</strong>";
                                    zipA.className = "zip-btn";
                                    downloadList.appendChild(zipA);
                                }

                                data.tracks.forEach(t => {
                                    const a = document.createElement('a');
                                    a.href = `${BACKEND_URL}${t.downloadLink}`;
                                    a.textContent = `⬇️ ${t.name}`;
                                    a.className = "track-btn";
                                    downloadList.appendChild(a);
                                });

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
                    }
                }
            }
        } catch (e) {
            console.error("Streaming error:", e);
            statusDiv.textContent = "Server error. Please try a smaller playlist or wait and try again.";
        } finally { 
            resetUI();
        }
    });
});

function openModal(id) { document.getElementById(id).style.display = "flex"; }
function closeModal(id) { document.getElementById(id).style.display = "none"; }
window.onclick = (e) => { if (e.target.className === 'modal') e.target.style.display = "none"; };