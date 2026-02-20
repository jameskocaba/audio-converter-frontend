document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('urlInput');
    const emailInput = document.getElementById('emailInput'); 
    const startTimeInput = document.getElementById('startTime'); // New
    const endTimeInput = document.getElementById('endTime');     // New
    const thumbnailContainer = document.getElementById('thumbnailContainer'); // New
    const currentThumbnail = document.getElementById('currentThumbnail');     // New
    const convertBtn = document.getElementById('convertBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const resetBtn = document.getElementById('resetBtn');
    const pasteBtn = document.getElementById('pasteBtn');
    const statusDiv = document.getElementById('status');
    const progressBar = document.getElementById('progressBar');
    const progressFill = document.getElementById('progressFill');
    const downloadArea = document.getElementById('downloadArea');
    const downloadList = document.getElementById('downloadList');

    const BACKEND_URL = 'https://audio-converter-backend.onrender.com'; 
    
    let currentSessionId = null;
    let pollInterval = null;

    const resetUI = () => {
        convertBtn.disabled = false;
        cancelBtn.disabled = false;
        cancelBtn.textContent = "Cancel";
        cancelBtn.classList.add('hidden');
        resetBtn.classList.remove('hidden'); 
        progressBar.classList.add('hidden');
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    };

    const fullReset = () => {
        urlInput.value = '';
        if (emailInput) emailInput.value = ''; 
        if (startTimeInput) startTimeInput.value = ''; // Clear Time
        if (endTimeInput) endTimeInput.value = '';     // Clear Time
        statusDiv.innerHTML = "Ready";
        downloadList.innerHTML = '';
        downloadArea.classList.add('hidden');
        thumbnailContainer.classList.add('hidden'); // Hide Thumbnail
        currentThumbnail.src = '';
        resetUI();
    };

    const updateProgress = (current, total) => {
        const percent = total > 0 ? Math.round((current / total) * 100) : 0;
        progressFill.style.width = percent + '%';
        progressFill.textContent = `${current}/${total} (${percent}%)`;
    };

    const updateStatus = (message, stepInfo = '') => {
        let html = `<div class="spinner"></div>`;
        if (message) html += `<p>${message}</p>`;
        if (stepInfo) html += `<p class="step-info" style="font-size:0.8rem; color:#64748b;">${stepInfo}</p>`;
        statusDiv.innerHTML = html;
    };

    const pollStatus = async () => {
        if (!currentSessionId) return;

        try {
            const response = await fetch(`${BACKEND_URL}/status/${currentSessionId}`);
            if (!response.ok) throw new Error('Status check failed');
            const data = await response.json();
            
            if (data.status === 'queued') {
                progressBar.classList.add('hidden');
                const waitText = data.estimated_wait <= 1 ? "< 1 min" : `~${data.estimated_wait} mins`;

                statusDiv.innerHTML = `
                    <div class="queue-box">
                        <div class="spinner queue-spinner"></div>
                        <p style="font-weight:600; color:#d97706;">Waiting in Queue</p>
                        <p style="font-size:0.95rem; margin-top: 5px;">
                            Position: <span style="font-weight:bold; font-size:1.1rem;">${data.queue_position}</span>
                            <span style="margin: 0 8px; color: #cbd5e1;">|</span>
                            Est. Duration: <span style="font-weight:bold; color:#d97706;">${waitText}</span>
                        </p>
                    </div>
                `;
                return;
            }

            if (data.status === 'processing' || data.status === 'completed') {
                if (progressBar.classList.contains('hidden') && data.status === 'processing') {
                    progressBar.classList.remove('hidden');
                }
                updateProgress(data.completed + data.skipped, data.total);
            }

            if (data.status === 'cancelled') {
                clearInterval(pollInterval);
                pollInterval = null;
                statusDiv.innerHTML = `<p style="color:#ef4444; font-weight:bold;">Conversion Stopped.</p>`;
                resetUI();
                return;
            }

            if (data.status === 'processing') {
                const isStopping = cancelBtn.disabled && cancelBtn.textContent === "Stopping...";
                updateStatus(
                    isStopping ? "Stopping process..." : `Processing track ${data.current_track} of ${data.total}`,
                    data.current_status
                );
                
                // Show Thumbnail if available
                if (data.current_thumbnail && data.current_thumbnail !== currentThumbnail.src) {
                    currentThumbnail.src = data.current_thumbnail;
                    thumbnailContainer.classList.remove('hidden');
                }

            } else if (data.status === 'completed') {
                clearInterval(pollInterval);
                pollInterval = null;

                let successHtml = `
                    <p style="margin-bottom:8px;">
                        <span style="font-size:1.1rem; font-weight:600; color:#10b981;">&#127881; Complete!</span>
                    </p>
                `;
                
                statusDiv.innerHTML = successHtml;
                downloadArea.classList.remove('hidden');
                downloadList.innerHTML = '';

                if (data.zip_ready && data.zip_path) {
                    const zipA = document.createElement('a');
                    zipA.href = `${BACKEND_URL}${data.zip_path}`;
                    zipA.innerHTML = `<strong>&#128230; DOWNLOAD ALL (ZIP)</strong>`;
                    zipA.className = "zip-btn";
                    downloadList.appendChild(zipA);
                }
                resetUI();
            } else if (data.status === 'error') {
                clearInterval(pollInterval);
                pollInterval = null;
                statusDiv.innerHTML = `<p style="color:#ef4444;">Error: ${data.error}</p>`;
                resetUI();
            }
        } catch (error) {
            console.error('Poll error:', error);
        }
    };

    pasteBtn.addEventListener('click', async () => {
        try {
            urlInput.value = await navigator.clipboard.readText();
        } catch (err) { alert("Please paste manually."); }
    });

    resetBtn.addEventListener('click', fullReset);

    cancelBtn.addEventListener('click', async () => {
        if (!currentSessionId) return;
        cancelBtn.disabled = true;
        cancelBtn.textContent = "Stopping...";
        statusDiv.innerHTML = `<div class="spinner" style="border-left-color: #ef4444;"></div><p>Sending stop signal...</p>`;

        try {
            await fetch(`${BACKEND_URL}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: currentSessionId }),
            });
        } catch (e) { 
            console.error("Cancel request failed", e); 
        }
    });

    convertBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        const email = emailInput ? emailInput.value.trim() : "";
        const startTime = startTimeInput ? startTimeInput.value.trim() : "";
        const endTime = endTimeInput ? endTimeInput.value.trim() : "";
        
        if (!url) { alert('Please enter a URL'); return; }

        currentSessionId = self.crypto.randomUUID();
        convertBtn.disabled = true;
        resetBtn.classList.add('hidden');
        cancelBtn.classList.remove('hidden');
        statusDiv.innerHTML = `<div class="spinner"></div><p>Connecting to server...</p>`;

        try {
            const response = await fetch(`${BACKEND_URL}/start_conversion`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    url: url, 
                    session_id: currentSessionId,
                    email: email,
                    start_time: startTime, // Send times to backend
                    end_time: endTime
                }),
            });

            if (!response.ok) throw new Error('Server error starting conversion');
            const data = await response.json();
            
            if (data.status === 'started' || data.status === 'queued') {
                pollInterval = setInterval(pollStatus, 2000);
            }
        } catch (e) {
            statusDiv.innerHTML = `<p style="color:#ef4444;">${e.message}</p>`;
            resetUI();
        }
    });
});