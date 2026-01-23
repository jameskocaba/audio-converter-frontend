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
    let pollInterval = null;

    // --- Helper Functions ---
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
        statusDiv.innerHTML = "Ready";
        downloadList.innerHTML = '';
        downloadArea.classList.add('hidden');
        resetUI();
    };

    const updateProgress = (current, total) => {
        const percent = total > 0 ? Math.round((current / total) * 100) : 0;
        progressFill.style.width = percent + '%';
        progressFill.textContent = `${current}/${total} (${percent}%)`;
    };

    const updateStatus = (message, stepInfo = '', queueInfo = null) => {
        let html = '';
        
        // Queue position badge
        if (queueInfo && queueInfo.position > 0) {
            html += `<div class="queue-badge">📋 Position in Queue: #${queueInfo.position}</div>`;
        }
        
        // Spinner for active processing
        if (!queueInfo || queueInfo.position === 0) {
            html += `<div class="spinner"></div>`;
        }
        
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
            
            // Handle Queue Status
            if (data.status === 'queued' && data.queue_position > 0) {
                updateStatus(
                    `⏳ Waiting in queue...`,
                    `Your conversion will start soon. Please keep this tab open.`,
                    { position: data.queue_position }
                );
                progressBar.classList.add('hidden');
                return;
            }
            
            // Show progress bar once processing starts
            if (data.status === 'processing') {
                progressBar.classList.remove('hidden');
            }
            
            updateProgress(data.completed + data.skipped, data.total);

            // Handle Cancellation State
            if (data.status === 'cancelled') {
                clearInterval(pollInterval);
                pollInterval = null;
                statusDiv.innerHTML = `<p style="color:#ef4444; font-weight:bold;">⛔ Conversion Stopped.</p><p style="font-size:0.8rem;">Session cleared.</p>`;
                resetUI();
                return;
            }

            if (data.status === 'processing') {
                const isStopping = cancelBtn.disabled && cancelBtn.textContent === "Stopping...";
                updateStatus(
                    isStopping ? "⛔ Stopping process..." : `Processing track ${data.current_track} of ${data.total}`,
                    data.current_status
                );
            } else if (data.status === 'completed') {
                clearInterval(pollInterval);
                pollInterval = null;

                statusDiv.innerHTML = `
                    <p style="font-size:1.1rem; font-weight:600; color:#10b981; margin-bottom:8px;">🎉 Conversion Complete!</p>
                    <p style="color:#64748b; font-size:0.85rem;">${data.completed} tracks successfully converted</p>
                `;

                downloadArea.classList.remove('hidden');
                downloadList.innerHTML = '';

                if (data.zip_ready && data.zip_path) {
                    const zipA = document.createElement('a');
                    zipA.href = `${BACKEND_URL}${data.zip_path}`;
                    zipA.innerHTML = `<strong>📦 DOWNLOAD ALL (ZIP)</strong>`;
                    zipA.className = "zip-btn";
                    downloadList.appendChild(zipA);
                }
                resetUI();
            } else if (data.status === 'error') {
                clearInterval(pollInterval);
                pollInterval = null;
                statusDiv.innerHTML = `<p style="color:#ef4444;">❌ Error: ${data.error || 'Unknown error'}</p>`;
                resetUI();
            }
        } catch (error) {
            console.error('Poll error:', error);
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

        // Immediate Visual Feedback
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
        if (!url) { alert('Please enter a URL'); return; }

        currentSessionId = self.crypto.randomUUID();
        convertBtn.disabled = true;
        resetBtn.classList.add('hidden');
        cancelBtn.classList.remove('hidden');
        updateStatus('Connecting to server...');

        try {
            const response = await fetch(`${BACKEND_URL}/start_conversion`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url, session_id: currentSessionId }),
            });

            if (!response.ok) throw new Error('Server error starting conversion');
            const data = await response.json();
            
            if (data.status === 'started' || data.status === 'queued') {
                if (data.queue_position > 0) {
                    updateStatus(
                        `⏳ Added to queue`,
                        `You are #${data.queue_position} in line. Total tracks: ${data.total_tracks}`,
                        { position: data.queue_position }
                    );
                } else {
                    progressBar.classList.remove('hidden');
                    updateProgress(0, data.total_tracks);
                }
                pollInterval = setInterval(pollStatus, 2000);
            }
        } catch (e) {
            statusDiv.innerHTML = `<p style="color:#ef4444;">❌ ${e.message}</p>`;
            resetUI();
        }
    });
});

// Global Modal Helpers
function openModal(id) { document.getElementById(id).style.display = "flex"; }
function closeModal(id) { document.getElementById(id).style.display = "none"; }
window.onclick = (e) => { if (e.target.classList.contains('modal')) e.target.style.display = "none"; };