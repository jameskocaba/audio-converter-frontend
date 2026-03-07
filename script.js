document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('urlInput');
    const emailInput = document.getElementById('emailInput'); 
    const startTimeInput = document.getElementById('startTime'); 
    const endTimeInput = document.getElementById('endTime');     
    const transcribeInput = document.getElementById('transcribeAudio'); 
    const thumbnailContainer = document.getElementById('thumbnailContainer'); 
    const currentThumbnail = document.getElementById('currentThumbnail');     
    
    const convertBtn = document.getElementById('convertBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const resetBtn = document.getElementById('resetBtn');
    const actionGroup = document.getElementById('actionGroup');
    const statusDiv = document.getElementById('status');
    const progressBar = document.getElementById('progressBar');
    const progressFill = document.getElementById('progressFill');
    const downloadArea = document.getElementById('downloadArea');
    const downloadList = document.getElementById('downloadList');
    
    const topConversionsArea = document.getElementById('topConversionsArea');
    const topConversionsList = document.getElementById('topConversionsList');

    // Backend URL
    const BACKEND_URL = '[https://audio-converter-backend.onrender.com](https://audio-converter-backend.onrender.com)'; 
    
    let currentSessionId = null;
    let pollInterval = null;

    // --- Fetch Top 3 Conversions ---
    const fetchTopConversions = async () => {
        // If the request takes more than 3 seconds, Render is likely asleep.
        // Update the UI so the user knows what's happening.
        const slowLoadTimer = setTimeout(() => {
            topConversionsList.innerHTML = `
                <div style="width: 100%; text-align: center; color: #64748b; font-size: 0.85rem; padding: 10px;">
                    <div class="spinner" style="width: 20px; height: 20px; border-width: 2px; margin: 0 auto 8px; border-left-color: #cbd5e1;"></div>
                    Waking up free-tier server...<br>
                    <span style="font-size: 0.75rem; color: #94a3b8;">(This can take up to 50 seconds)</span>
                </div>
            `;
        }, 3000);

        try {
            const response = await fetch(`${BACKEND_URL}/api/top-conversions`);
            
            // Clear the "waking up" message timer once we get a response
            clearTimeout(slowLoadTimer); 
            
            if (response.ok) {
                const data = await response.json();
                if (data.length > 0) {
                    topConversionsList.innerHTML = data.map((item) => {
                        
                        // Fallback logic in case ANY image link is broken
                        const fallbackDiv = `<div style="width: 100%; height: 60px; background: #e2e8f0; border-radius: 4px; margin-bottom: 5px; display:flex; align-items:center; justify-content:center; font-size:10px; color:#94a3b8;">N/A</div>`;
                        
                        const thumbHtml = item.thumbnail 
                            ? `<img src="${item.thumbnail}" alt="thumb" onerror="this.outerHTML=this.dataset.fallback" data-fallback='${fallbackDiv}' style="width: 100%; height: 60px; object-fit: cover; border-radius: 4px; display: block; margin-bottom: 5px;">` 
                            : fallbackDiv;
                        
                        return `
                        <div style="flex: 1; min-width: 0; background: white; border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex; flex-direction: column;">
                            <a href="${item.url}" target="_blank" title="View Original" style="text-decoration: none; color: inherit; display: block; flex-grow: 1;">
                                ${thumbHtml}
                                <div style="font-size: 0.7rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 3px; color: #334155;">
                                    ${item.title}
                                </div>
                            </a>
                            <div style="font-size: 0.65rem; color: #64748b; background: #f1f5f9; border-radius: 3px; padding: 2px;">
                                ${item.count} conversions
                            </div>
                        </div>`;
                    }).join('');
                } else {
                    topConversionsList.innerHTML = '<div style="color: #94a3b8; font-size: 0.85rem; width: 100%; text-align: center;">No conversions yet. Be the first!</div>';
                }
            } else {
                topConversionsList.innerHTML = '<div style="color: #ef4444; font-size: 0.85rem; width: 100%; text-align: center;">Server error. Retrying...</div>';
                setTimeout(fetchTopConversions, 5000); 
            }
        } catch (error) {
            clearTimeout(slowLoadTimer);
            console.error("Failed to load top conversions:", error);
            topConversionsList.innerHTML = '<div style="color: #ef4444; font-size: 0.85rem; width: 100%; text-align: center;">Cannot connect to server. Retrying...</div>';
            setTimeout(fetchTopConversions, 5000);
        }
    };

    // Load them immediately on page load
    fetchTopConversions();

    // --- Helper Functions ---
    const resetUI = () => {
        convertBtn.disabled = false;
        convertBtn.textContent = "Process";
        cancelBtn.disabled = false;
        cancelBtn.textContent = "Cancel";
        cancelBtn.classList.add('hidden');
        resetBtn.disabled = false; 
        progressBar.classList.add('hidden');
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    };

    const fullReset = () => {
        urlInput.value = '';
        if (emailInput) emailInput.value = ''; 
        if (startTimeInput) {
            startTimeInput.value = ''; 
            startTimeInput.classList.remove('input-error');
        }
        if (endTimeInput) {
            endTimeInput.value = '';  
            endTimeInput.classList.remove('input-error');
        }
        if (transcribeInput) transcribeInput.checked = false;   
        statusDiv.innerHTML = "Ready";
        downloadList.innerHTML = '';
        downloadArea.classList.add('hidden');
        thumbnailContainer.classList.add('hidden'); 
        currentThumbnail.src = '';
        actionGroup.style.display = 'none'; 
        topConversionsArea.classList.remove('hidden');
        fetchTopConversions(); // Refresh the list on reset
        resetUI();
    };

    const updateProgress = (current, total, subProgress = 0) => {
        const overallProgress = current + (subProgress / 100);
        const percent = total > 0 ? Math.min(Math.round((overallProgress / total) * 100), 100) : 0;
        
        progressFill.style.width = percent + '%';
        progressFill.textContent = `${current}/${total} (${percent}%)`;
    };

    // Validates HH:MM:SS or MM:SS format
    const validateTimeFormat = (timeStr) => {
        if (!timeStr) return true; 
        const regex = /^(\d{1,2}:){1,2}[0-5]\d$/;
        return regex.test(timeStr);
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
                        <p style="margin:0 0 5px 0; font-weight:bold;">Waiting in Queue</p>
                        <p style="margin:0; font-size:0.85rem;">Position: ${data.queue_position} | Est. Wait: ${waitText}</p>
                    </div>
                `;
            } 
            // --- STATE: PROCESSING ---
            else if (data.status === 'processing') {
                progressBar.classList.remove('hidden');
                
                if (data.current_thumbnail) {
                    currentThumbnail.src = data.current_thumbnail;
                    thumbnailContainer.classList.remove('hidden');
                }
                
                updateProgress(data.completed, data.total, data.sub_progress);
                
                statusDiv.innerHTML = `
                    <div class="spinner"></div>
                    <p style="margin:0; font-weight:bold;">Processing...</p>
                    <p style="margin:5px 0 0 0; font-size:0.85rem; color:#64748b;">${data.current_status || 'Working on your files'}</p>
                `;
            }
            // --- STATE: COMPLETED ---
            else if (data.status === 'completed') {
                resetUI();
                progressBar.classList.remove('hidden');
                updateProgress(data.total, data.total, 100);
                
                statusDiv.innerHTML = `<p style="color: #2ecc71; font-weight: bold;">✅ Success! Conversion complete.</p>`;
                
                downloadArea.classList.remove('hidden');
                downloadList.innerHTML = `
                    <li>
                        <a href="${BACKEND_URL}${data.zip_path}" class="zip-btn" target="_blank">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            Download ZIP Archive
                        </a>
                    </li>
                `;
                currentSessionId = null;
            }
            // --- STATE: ERROR / CANCELLED ---
            else if (data.status === 'error' || data.status === 'cancelled') {
                resetUI();
                const msg = data.status === 'error' ? 'An error occurred during processing.' : 'Process Cancelled.';
                statusDiv.innerHTML = `<p style="color: #ef4444; font-weight: bold;">❌ ${msg}</p>`;
                currentSessionId = null;
            }
        } catch (error) {
            console.error('Polling error:', error);
        }
    };

    const startConversion = async () => {
        const url = urlInput.value.trim();
        if (!url) {
            statusDiv.innerHTML = `<p style="color: #ef4444;">Please enter a valid URL.</p>`;
            return;
        }

        const startTime = startTimeInput.value.trim();
        const endTime = endTimeInput.value.trim();

        if (!validateTimeFormat(startTime) || !validateTimeFormat(endTime)) {
            statusDiv.innerHTML = `<p style="color: #ef4444;">Invalid time format. Use MM:SS or HH:MM:SS.</p>`;
            return;
        }

        const email = emailInput ? emailInput.value.trim() : '';
        const transcribeAudio = transcribeInput ? transcribeInput.checked : false;

        // UI Updates for processing state
        convertBtn.disabled = true;
        convertBtn.textContent = "Processing...";
        resetBtn.disabled = true;
        actionGroup.style.display = 'flex';
        cancelBtn.classList.remove('hidden');
        topConversionsArea.classList.add('hidden'); // Hide the trending list while converting
        
        statusDiv.innerHTML = `<div class="spinner"></div><p>Starting...</p>`;
        downloadArea.classList.add('hidden');
        thumbnailContainer.classList.add('hidden');
        progressBar.classList.add('hidden');
        progressFill.style.width = '0%';
        progressFill.textContent = '';

        try {
            const response = await fetch(`${BACKEND_URL}/start_conversion`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url, 
                    email, 
                    start_time: startTime, 
                    end_time: endTime, 
                    transcribe_audio: transcribeAudio
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to start conversion');
            }

            currentSessionId = data.session_id;
            pollInterval = setInterval(pollStatus, 2000);
            pollStatus(); 
        } catch (error) {
            resetUI();
            statusDiv.innerHTML = `<p style="color: #ef4444;">❌ ${error.message}</p>`;
        }
    };

    const cancelConversion = async () => {
        if (!currentSessionId) return;
        cancelBtn.disabled = true;
        cancelBtn.textContent = "Cancelling...";
        
        try {
            await fetch(`${BACKEND_URL}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: currentSessionId })
            });
        } catch (error) {
            console.error('Failed to cancel:', error);
            resetUI();
        }
    };

    // --- Event Listeners ---
    convertBtn.addEventListener('click', startConversion);
    cancelBtn.addEventListener('click', cancelConversion);
    resetBtn.addEventListener('click', fullReset);
});