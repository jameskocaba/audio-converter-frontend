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
        cancelBtn.classList.add('hidden');
        resetBtn.classList.remove('hidden'); 
        progressBar.classList.add('hidden');
        currentSessionId = null;
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

    const updateStatus = (message, trackName = '', stepInfo = '') => {
        let html = `<div class="spinner"></div>`;
        if (message) {
            html += `<p>${message}</p>`;
        }
        if (trackName) {
            html += `<p class="track-name">${trackName}</p>`;
        }
        if (stepInfo) {
            html += `<p class="step-info">${stepInfo}</p>`;
        }
        statusDiv.innerHTML = html;
    };

    const pollStatus = async () => {
        if (!currentSessionId) return;

        try {
            const response = await fetch(`${BACKEND_URL}/status/${currentSessionId}`);
            
            if (!response.ok) {
                throw new Error('Failed to get status');
            }

            const data = await response.json();
            
            // Update progress bar
            const totalProcessed = data.completed + data.skipped;
            updateProgress(totalProcessed, data.total);

            // Update status message
            if (data.status === 'processing') {
                updateStatus(
                    `Processing track ${data.current_track} of ${data.total}`,
                    '',
                    data.current_status
                );
            } else if (data.status === 'completed') {
                // Stop polling
                clearInterval(pollInterval);
                pollInterval = null;

                // Show completion
                statusDiv.innerHTML = `
                    <p style="font-size:1.1rem; font-weight:600; color:#10b981; margin-bottom:8px;">🎉 Conversion Complete!</p>
                    <p style="color:#64748b; font-size:0.85rem;">${data.completed} tracks successfully converted${data.skipped > 0 ? ` • ${data.skipped} unavailable` : ''}</p>
                `;

                // Show download area
                downloadArea.classList.remove('hidden');
                downloadList.innerHTML = '';

                if (data.zip_ready && data.zip_path) {
                    const zipA = document.createElement('a');
                    zipA.href = `${BACKEND_URL}${data.zip_path}`;
                    zipA.innerHTML = `<strong>📦 DOWNLOAD ALL (ZIP) - ${data.completed} Tracks</strong>`;
                    zipA.className = "zip-btn";
                    downloadList.appendChild(zipA);
                }

                // Show skipped tracks
                if (data.skipped_tracks && data.skipped_tracks.length > 0) {
                    const skipHeader = document.createElement('div');
                    skipHeader.style.cssText = "margin-top:15px; padding:10px; background:#fef2f2; border-left:3px solid #ef4444; border-radius:4px;";
                    skipHeader.innerHTML = `<strong style='color:#ef4444'>⚠️ Unavailable Tracks (${data.skipped_tracks.length}):</strong>`;
                    downloadList.appendChild(skipHeader);
                    
                    data.skipped_tracks.forEach(s => {
                        const li = document.createElement('div');
                        li.textContent = `🚫 ${s}`;
                        li.style.cssText = "font-size:12px; color:#64748b; margin-left:15px; padding:4px 0;";
                        downloadList.appendChild(li);
                    });
                }

                resetUI();
            } else if (data.status === 'cancelled') {
                clearInterval(pollInterval);
                pollInterval = null;
                statusDiv.textContent = "⏸️ Conversion stopped by user.";
                resetUI();
            } else if (data.status === 'error') {
                clearInterval(pollInterval);
                pollInterval = null;
                statusDiv.innerHTML = `<p style="color:#ef4444;">❌ Error during conversion</p>`;
                resetUI();
            }

        } catch (error) {
            console.error('Poll error:', error);
            // Don't stop polling on single error - server might be waking up
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

        try {
            statusDiv.innerHTML = "⏸️ Stopping conversion...";
            await fetch(`${BACKEND_URL}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: currentSessionId }),
            });
        } catch (e) { 
            console.error("Cancel error", e); 
        }
    });

    convertBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) {
            alert('Please enter a URL');
            return;
        }

        currentSessionId = self.crypto.randomUUID();

        convertBtn.disabled = true;
        resetBtn.classList.add('hidden');
        cancelBtn.classList.remove('hidden');
        progressBar.classList.remove('hidden');
        progressFill.style.width = '0%';
        progressFill.textContent = '0/0 (0%)';
        
        updateStatus('Starting conversion...');
        downloadArea.classList.add('hidden');

        try {
            // Start conversion
            const response = await fetch(`${BACKEND_URL}/start_conversion`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    url: url,
                    session_id: currentSessionId 
                }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP Error ${response.status}`);
            }

            const data = await response.json();
            
            if (data.status === 'started') {
                updateStatus(`Found ${data.total_tracks} tracks. Starting download...`);
                updateProgress(0, data.total_tracks);
                
                // Start polling every 2 seconds
                pollInterval = setInterval(pollStatus, 2000);
                
                // Initial poll
                pollStatus();
            } else {
                throw new Error('Failed to start conversion');
            }

        } catch (e) {
            console.error("Conversion error:", e);
            statusDiv.innerHTML = `<p style="color:#ef4444;">❌ Error: ${e.message}</p>`;
            resetUI();
        }
    });
});

/**
 * --- GLOBAL MODAL FUNCTIONS ---
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