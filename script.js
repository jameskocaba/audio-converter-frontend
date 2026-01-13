document.addEventListener('DOMContentLoaded', () => {
    // --- Element Selectors ---
    const urlInput = document.getElementById('urlInput');
    const convertBtn = document.getElementById('convertBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const resetBtn = document.getElementById('resetBtn');
    const statusDiv = document.getElementById('status');
    const progressBar = document.getElementById('progressBar');
    const progressFill = document.getElementById('progressFill');
    const downloadArea = document.getElementById('downloadArea');
    const downloadList = document.getElementById('downloadList');

    const BACKEND_URL = 'https://audio-converter-backend.onrender.com'; 
    let currentSessionId = null;
    let downloadController = null; // Used to stop the browser's request

    // --- Helper Functions ---
    const resetUIState = () => {
        convertBtn.disabled = false;
        cancelBtn.classList.add('hidden');
        resetBtn.classList.remove('hidden'); 
        progressBar.classList.add('hidden');
    };

    const updateProgress = (current, total) => {
        const percent = total > 0 ? Math.round((current / total) * 100) : 0;
        progressFill.style.width = percent + '%';
        progressFill.textContent = `${current}/${total} (${percent}%)`;
    };

    // --- Button: RESET ---
    const fullReset = () => {
        if (downloadController) downloadController.abort();
        urlInput.value = '';
        statusDiv.textContent = "Ready";
        downloadList.innerHTML = '';
        downloadArea.classList.add('hidden');
        resetUIState();
    };
    resetBtn.addEventListener('click', fullReset);

    // --- Button: CANCEL ---
    cancelBtn.addEventListener('click', async () => {
        if (!currentSessionId) return;

        // 1. Instantly stop the browser from listening
        if (downloadController) downloadController.abort();

        // 2. Tell backend to kill FFmpeg/yt-dlp
        try {
            fetch(`${BACKEND_URL}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: currentSessionId }),
                keepalive: true 
            });
        } catch (e) { console.error("Cancel failed", e); }

        statusDiv.textContent = "Conversion stopped.";
        resetUIState();
    });

    // --- Button: CONVERT ---
    convertBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) return;

        // Reset state for new run
        currentSessionId = self.crypto.randomUUID();
        downloadController = new AbortController(); // CRITICAL: New controller for every click

        convertBtn.disabled = true;
        resetBtn.classList.add('hidden');
        cancelBtn.classList.remove('hidden');
        progressBar.classList.remove('hidden');
        updateProgress(0, 0);
        
        statusDiv.innerHTML = `<div class="spinner"></div><p>Analyzing playlist...</p>`;
        downloadArea.classList.add('hidden');

        try {
            const response = await fetch(`${BACKEND_URL}/convert`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    url: url,
                    session_id: currentSessionId 
                }),
                signal: downloadController.signal // Link the abort signal
            });

            if (!response.ok) throw new Error(`Server returned ${response.status}`);

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
                            
                            if (data.type === 'total') {
                                updateProgress(0, data.total);
                            } else if (data.type === 'progress') {
                                updateProgress(data.current, data.total);
                                statusDiv.innerHTML = `<div class="spinner"></div><p>Converting: <strong>${data.track}</strong></p>`;
                            } else if (data.type === 'done') {
                                statusDiv.innerHTML = `✅ Successfully processed ${data.total_processed} tracks.`;
                                downloadArea.classList.remove('hidden');
                                downloadList.innerHTML = `<a href="${BACKEND_URL}${data.zipLink}" class="zip-btn">DOWNLOAD PLAYLIST (ZIP)</a>`;
                            } else if (data.type === 'error') {
                                throw new Error(data.message);
                            }
                        } catch (err) { console.warn("JSON Error", line); }
                    }
                }
            }
        } catch (e) {
            if (e.name === 'AbortError') {
                console.log("User aborted the request.");
            } else {
                statusDiv.textContent = `Error: ${e.message}`;
                resetUIState();
            }
        } finally {
            // Keep the "Download" button visible if successful, otherwise reset
            if (!downloadArea.classList.contains('hidden')) {
                convertBtn.disabled = false;
                cancelBtn.classList.add('hidden');
                resetBtn.classList.remove('hidden');
            } else {
                resetUIState();
            }
        }
    });
});