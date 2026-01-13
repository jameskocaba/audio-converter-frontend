document.addEventListener('DOMContentLoaded', () => {
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
    let downloadController = null;

    const resetUI = () => {
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

    cancelBtn.addEventListener('click', async () => {
        if (!currentSessionId) return;

        // 1. Force hang up the browser connection
        if (downloadController) downloadController.abort();

        // 2. Tell backend to stop FFmpeg
        try {
            fetch(`${BACKEND_URL}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: currentSessionId }),
                keepalive: true 
            });
        } catch (e) {}

        statusDiv.textContent = "Conversion cancelled.";
        resetUI();
    });

    convertBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) return;

        currentSessionId = self.crypto.randomUUID();
        downloadController = new AbortController();

        convertBtn.disabled = true;
        resetBtn.classList.add('hidden');
        cancelBtn.classList.remove('hidden');
        progressBar.classList.remove('hidden');
        updateProgress(0, 0);
        
        statusDiv.innerHTML = `<div class="spinner"></div><p>Connecting...</p>`;
        downloadArea.classList.add('hidden');

        try {
            const response = await fetch(`${BACKEND_URL}/convert`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, session_id: currentSessionId }),
                signal: downloadController.signal
            });

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
                        const data = JSON.parse(line.slice(6));
                        
                        if (data.type === 'total') {
                            updateProgress(0, data.total);
                        } else if (data.type === 'progress') {
                            updateProgress(data.current, data.total);
                            statusDiv.innerHTML = `<div class="spinner"></div><p>Processing: <strong>${data.track}</strong></p>`;
                        } else if (data.type === 'done') {
                            statusDiv.innerHTML = `✅ Ready!`;
                            downloadArea.classList.remove('hidden');
                            downloadList.innerHTML = `<a href="${BACKEND_URL}${data.zipLink}" class="zip-btn">DOWNLOAD FULL PLAYLIST (ZIP)</a>`;
                        } else if (data.type === 'error') {
                            throw new Error(data.message);
                        }
                    }
                }
            }
        } catch (e) {
            if (e.name !== 'AbortError') statusDiv.textContent = `Error: ${e.message}`;
        } finally { 
            resetUI();
        }
    });
});