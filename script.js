document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('urlInput');
    const emailInput = document.getElementById('emailInput'); 
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
    let wakeLock = null;

    // --- UTILITY: Generate UUID (Works in non-HTTPS too) ---
    const generateSessionId = () => {
        if (typeof self.crypto !== 'undefined' && typeof self.crypto.randomUUID === 'function') {
            return self.crypto.randomUUID();
        }
        // Fallback for non-secure contexts
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };

    // --- WAKE LOCK HANDLERS ---
    const requestWakeLock = async () => {
        if ('wakeLock' in navigator) {
            try {
                wakeLock = await navigator.wakeLock.request('screen');
                console.log('Screen Wake Lock active');
            } catch (err) {
                console.warn(`Wake Lock ignored: ${err.name}, ${err.message}`);
            }
        }
    };

    const releaseWakeLock = async () => {
        if (wakeLock !== null) {
            try {
                await wakeLock.release();
                wakeLock = null;
                console.log('Screen Wake Lock released');
            } catch (err) {
                console.warn(`Wake Lock release error: ${err.message}`);
            }
        }
    };

    // --- UI HELPERS ---
    const resetUI = () => {
        convertBtn.disabled = false; // Re-enable button
        cancelBtn.disabled = false;
        cancelBtn.textContent = "Cancel";
        cancelBtn.classList.add('hidden');
        resetBtn.classList.remove('hidden'); 
        progressBar.classList.add('hidden');
        
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }

        releaseWakeLock(); // Always release lock when UI resets
    };

    const fullReset = () => {
        urlInput.value = '';
        if (emailInput) emailInput.value = ''; 
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

    const updateStatus = (message, stepInfo = '') => {
        let html = `<div class="spinner"></div>`;
        if (message) html += `<p>${message}</p>`;
        // Split artist/track info for better visibility
        if (stepInfo) {
            html += `<p class="step-info" style="font-weight:600; color:#2980b9; margin-top:4px;">${stepInfo}</p>`;
        }
        statusDiv.innerHTML = html;
    };

    const pollStatus = async () => {
        if (!currentSessionId) return;

        try {
            const response = await fetch(`${BACKEND_URL}/status/${currentSessionId}`);
            if (!response.ok) throw new Error('Status check failed');
            const data = await response.json();
            
            // QUEUED STATE
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

            // PROCESSING STATE
            if (data.status === 'processing' || data.status === 'completed') {
                if (progressBar.classList.contains('hidden') && data.status === 'processing') {
                    progressBar.classList.remove('hidden');
                }
                updateProgress(data.completed + data.skipped, data.total);
            }

            // CANCELLED STATE
            if (data.status === 'cancelled') {
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
            } else if (data.status === 'completed') {
                let successHtml = `
                    <p style="font-size:1.1rem; font-weight:600; color:#10b981; margin-bottom:8px;">&#127881; Conversion Complete!</p>
                    <p style="color:#64748b; font-size:0.85rem;">${data.completed} track(s) successfully converted</p>
                `;
                
                if (emailInput && emailInput.value) {
                    successHtml += `<p style="font-size:0.8rem; color:#3b82f6; margin-top:5px; font-weight:500;">📩 Notification sent to ${emailInput.value}</p>`;
                }

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
                statusDiv.innerHTML = `<p style="color:#ef4444;">Error: ${data.error || 'Unknown error'}</p>`;
                resetUI();
            }
        } catch (error) {
            console.error('Poll error:', error);
            // Don't reset UI on single poll failure, just log it
        }
    };

    // --- EVENT LISTENERS ---
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
        
        if (!url) { alert('Please enter a URL'); return; }

        // 1. Generate ID (Safe Mode)
        currentSessionId = generateSessionId();

        // 2. Disable Button Immediately
        convertBtn.disabled = true;
        resetBtn.classList.add('hidden');
        cancelBtn.classList.remove('hidden');
        statusDiv.innerHTML = `<div class="spinner"></div><p>Connecting to server...</p>`;

        // 3. Request Wake Lock (Async - don't block main flow if it fails)
        requestWakeLock().catch(e => console.warn("Wake lock failed", e));

        // 4. Start Conversion
        try {
            const response = await fetch(`${BACKEND_URL}/start_conversion`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    url: url, 
                    session_id: currentSessionId,
                    email: email 
                }),
            });

            if (!response.ok) throw new Error('Server error starting conversion');
            const data = await response.json();
            
            if (data.status === 'started' || data.status === 'queued') {
                pollInterval = setInterval(pollStatus, 2000);
            } else {
                // If backend returns immediate error
                throw new Error(data.error || "Unknown startup error");
            }
        } catch (e) {
            statusDiv.innerHTML = `<p style="color:#ef4444;">${e.message}</p>`;
            resetUI();
        }
    });
});

// Modal Global Helpers
function openModal(id) { document.getElementById(id).style.display = "flex"; }
function closeModal(id) { document.getElementById(id).style.display = "none"; }
window.onclick = (e) => { if (e.target.classList.contains('modal')) e.target.style.display = "none"; };