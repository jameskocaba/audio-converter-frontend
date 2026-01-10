document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('urlInput');
    const convertBtn = document.getElementById('convertBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const resetBtn = document.getElementById('resetBtn');
    const statusDiv = document.getElementById('status');
    const downloadArea = document.getElementById('downloadArea');
    const downloadList = document.getElementById('downloadList');

    const BACKEND_URL = 'https://audio-converter-backend.onrender.com'; 
    let pollInterval = null;
    let currentSessionId = null;

    const resetUI = () => {
        convertBtn.disabled = false;
        cancelBtn.classList.add('hidden');
        resetBtn.classList.remove('hidden'); 
        if (pollInterval) clearInterval(pollInterval);
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

    convertBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) return;

        convertBtn.disabled = true;
        cancelBtn.classList.remove('hidden');
        resetBtn.classList.add('hidden');
        statusDiv.innerHTML = `<div class="spinner"></div><p>Connecting to server...</p>`;

        try {
            const res = await fetch(`${BACKEND_URL}/convert`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            const data = await res.json();
            currentSessionId = data.session_id;

            // Start Polling
            pollInterval = setInterval(async () => {
                try {
                    const sRes = await fetch(`${BACKEND_URL}/status/${currentSessionId}`);
                    const result = await sRes.json();

                    if (!result || result.status === "not_found") return;

                    if (result.status === "processing") {
                        statusDiv.innerHTML = `<div class="spinner"></div><p>Downloaded ${result.count} tracks...</p>`;
                    } else if (result.status === "completed") {
                        renderResults(result);
                        resetUI();
                    } else if (result.status === "error") {
                        statusDiv.textContent = "Error: " + result.message;
                        resetUI();
                    }
                } catch (e) { console.error("Polling error", e); }
            }, 3000);

        } catch (err) {
            statusDiv.textContent = "Server error. Please try again.";
            resetUI();
        }
    });

    cancelBtn.addEventListener('click', async () => {
        if (!currentSessionId) return;
        fetch(`${BACKEND_URL}/cancel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: currentSessionId })
        });
        statusDiv.textContent = "Cancelled.";
        resetUI();
    });
});