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

    // Backend URL
    const BACKEND_URL = 'https://audio-converter-backend.onrender.com'; 
    
    let currentSessionId = null;
    let pollInterval = null;

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
        
        statusDiv.innerHTML = `<div class="spinner"></div><p>Spinning up the server. Please be patient...</p>`;
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