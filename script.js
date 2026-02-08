document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('urlInput');
    const emailInput = document.getElementById('emailInput'); // New field
    const convertBtn = document.getElementById('convertBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const resetBtn = document.getElementById('resetBtn');
    const pasteBtn = document.getElementById('pasteBtn');
    const statusDiv = document.getElementById('status');
    const progressBar = document.getElementById('progressBar');
    const progressFill = document.getElementById('progressFill');
    const downloadArea = document.getElementById('downloadArea');
    const downloadList = document.getElementById('downloadList');

    // Update this if you use a custom domain later, otherwise keep the onrender URL
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
        if (emailInput) emailInput.value = ''; // Clear email field
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
        if (stepInfo) html += `<p class="step-info" style="font-size:0.8rem; color:#64748b;">${stepInfo}</p>`;
        statusDiv.innerHTML = html;
    };

    const pollStatus = async () => {
        if (!currentSessionId) return;

        try {
            const response = await fetch(`${BACKEND_URL}/status/${currentSessionId}`);
            if (!response.ok) throw new Error('Status check failed');
            const data = await response.json();
            
            // --- STATE: WAITING IN QUEUE ---
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
                        <p style="font-size:0.8rem; color:#64748b; margin-top:5px;">Process will start automatically...</p>
                    </div>
                `;
                return;
            }

            // --- STATE: PROCESSING OR COMPLETED ---
            if (data.status === 'processing' || data.status === 'completed') {
                if (progressBar.classList.contains('hidden') && data.status === 'processing') {
                    progressBar.classList.remove('hidden');
                }
                updateProgress(data.completed + data.skipped, data.total);
            }

            // --- STATE: CANCELLED ---
            if (data.status === 'cancelled') {
                clearInterval(pollInterval);
                pollInterval = null;
                statusDiv.innerHTML = `<p style="color:#ef4444; font-weight:bold;">Conversion Stopped.</p><p style="font-size:0.8rem;">Session cleared.</p>`;
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
                clearInterval(pollInterval);
                pollInterval = null;

                // --- MODIFIED SECTION: Single Line Success Message ---
                let successHtml = `
                    <p style="margin-bottom:8px;">
                        <span style="font-size:1.1rem; font-weight:600; color:#10b981;">&#127881; Conversion Complete!</span>
                        <span style="color:#64748b; font-size:0.9rem; margin-left: 10px;"> ${data.completed} track(s) successfully converted</span>
                    </p>
                `;
                
                // Show notification confirmation if email was used
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
                clearInterval(pollInterval);
                pollInterval = null;
                statusDiv.innerHTML = `<p style="color:#ef4444;">Error: ${data.error || 'Unknown error'}</p>`;
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
                    email: email // Send email to backend
                }),
            });

            if (!response.ok) throw new Error('Server error starting conversion');
            const data = await response.json();
            
            // Handle both 'started' (immediate) or 'queued' (wait list)
            if (data.status === 'started' || data.status === 'queued') {
                pollInterval = setInterval(pollStatus, 2000);
            }
        } catch (e) {
            statusDiv.innerHTML = `<p style="color:#ef4444;">${e.message}</p>`;
            resetUI();
        }
    });

    /* ==========================================================================
       Google Analytics 4 Custom Event Tracking
       ========================================================================== */

    // 1. Track "Convert to MP3" Button Clicks
    if (convertBtn) {
        convertBtn.addEventListener('click', () => {
            // Only track if the input is not empty (valid attempt)
            if (urlInput && urlInput.value.trim() !== "" && typeof gtag === 'function') {
                gtag('event', 'convert_start', {
                    'event_category': 'Conversion',
                    'event_label': 'SoundCloud URL Submitted',
                    'transport_type': 'beacon'
                });
            }
        });
    }

    // 2. Track "Download" Clicks (Using Event Delegation)
    if (downloadList) {
        downloadList.addEventListener('click', (e) => {
            // Look for the closest anchor tag
            const downloadLink = e.target.closest('a');
            
            if (downloadLink && typeof gtag === 'function') {
                gtag('event', 'file_download', {
                    'event_category': 'Conversion',
                    'event_label': 'Download ZIP Success',
                    'file_extension': 'zip',
                    'file_name': downloadLink.getAttribute('download') || 'playlist_backup',
                    'transport_type': 'beacon'
                });
            }
        });
    }

});

// Global Modal Helpers
function openModal(id) { document.getElementById(id).style.display = "flex"; }
function closeModal(id) { document.getElementById(id).style.display = "none"; }
window.onclick = (e) => { if (e.target.classList.contains('modal')) e.target.style.display = "none"; };