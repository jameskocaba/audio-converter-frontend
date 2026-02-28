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
    const pasteBtn = document.getElementById('pasteBtn');
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
        resetUI();
    };

    const updateProgress = (current, total, subProgress = 0) => {
        // Add the fractional progress (0.0 to 0.99) of the current track
        const overallProgress = current + (subProgress / 100);
        
        // Calculate total percentage and cap it at 100%
        const percent = total > 0 ? Math.min(Math.round((overallProgress / total) * 100), 100) : 0;
        
        progressFill.style.width = percent + '%';
        progressFill.textContent = `${current}/${total} (${percent}%)`;
    };

    const updateStatus = (message, stepInfo = '') => {
        let html = `<div class="spinner"></div>`;
        if (message) html += `<p>${message}</p>`;
        if (stepInfo) html += `<p class="step-info" style="font-size:0.8rem; color:#64748b;">${stepInfo}</p>`;
        statusDiv.innerHTML = html;
    };

    // Validates HH:MM:SS or MM:SS format
    const validateTimeFormat = (timeStr) => {
        if (!timeStr) return true; // Empty string is valid (optional field)
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
                        <div class