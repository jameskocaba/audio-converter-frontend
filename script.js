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

    const resetUI = () => {
        convertBtn.disabled = false;
        cancelBtn.classList.add('hidden');
        resetBtn.classList.remove('hidden'); 
        progressBar.classList.add('hidden');
        currentSessionId = null;
    };

    const fullReset = () => {
        urlInput.value = '';
        statusDiv.textContent = "Ready";
        downloadList.innerHTML = '';
        downloadArea.classList.add('hidden');
        resetUI();
    };

    const updateProgress = (current, total) => {
        const percent = total > 0 ? Math.round((current / total) * 100) : 0;
        progressFill.style.width = percent + '%';
        progressFill.textContent = `${current}/${total} (${percent}%)`;
    };

    pasteBtn.addEventListener('click', async () => {
        try { urlInput.value = await navigator.clipboard.readText(); } 
        catch (err) { alert("Please paste manually."); }
    });

    clearBtn.addEventListener('click', () => {
        downloadList.innerHTML = '';
        downloadArea.classList.add('hidden');
        statusDiv.textContent = "Ready";
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

        convertBtn.disabled = true;
        resetBtn.classList.add('hidden');
        cancelBtn.classList.remove('hidden');
        progressBar.classList.remove('hidden');
        progressFill.style.width = '0%';
        progressFill.textContent = '0%';
        
        statusDiv.innerHTML = `<div class="spinner"></div><p>Starting conversion...</p>`;
        downloadArea.classList.add('hidden');

        try {
            const response = await fetch(`${BACKEND_URL}/convert`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url, session_id: currentSessionId }),
            });

            if (!response.ok) throw new Error(`HTTP Error ${response.status}`);

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
                                    statusDiv.innerHTML = `<div class="spinner"></div><p>Found ${data.total} tracks...</p>`;
                                    break;
                                    
                                case 'detail':
                                    // New: Shows "Downloading..." or "Zipping..." per track
                                    statusDiv.innerHTML = `<div class="spinner"></div><p><b>Track ${data.current}:</b> ${data.status}</p>`;
                                    break;

                                case 'progress':
                                    updateProgress(data.current, data.total);
                                    // Keep the detailed status visible, or revert to generic
                                    break;
                                    
                                case 'done':
                                    updateProgress(data.total_processed, data.total_expected);
                                    statusDiv.innerHTML = `✅ Complete! ${data.total_processed} tracks ready.`;
                                    downloadArea.classList.remove('hidden');
                                    downloadList.innerHTML = ''; 

                                    if (data.zipLink) {
                                        const zipA = document.createElement('a');
                                        zipA.href = `${BACKEND_URL}${data.zipLink}`;
                                        zipA.innerHTML = "<strong>📦 DOWNLOAD ZIP</strong>";
                                        zipA.className = "zip-btn";
                                        downloadList.appendChild(zipA);
                                    }
                                    
                                    if (data.skipped && data.skipped.length > 0) {
                                        const skipHeader = document.createElement('li');
                                        skipHeader.innerHTML = "<br><strong>⚠️ Skipped Tracks:</strong>";
                                        downloadList.appendChild(skipHeader);
                                        data.skipped.forEach(s => {
                                            const li = document.createElement('li');
                                            li.textContent = `🚫 ${s}`;
                                            li.style.color = "#ef4444";
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
                        } catch (e) { console.warn("Parse error", e); }
                    }
                }
            }
        } catch (e) {
            statusDiv.textContent = `Error: ${e.message}`;
        } finally { 
            resetUI();
        }
    });
});