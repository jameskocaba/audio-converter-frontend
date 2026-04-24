let currentSessionId = null;
let pollingInterval = null;

async function startConversion(url, userEmail, transcribeAudio) {
    try {
        const response = await fetch('/start_conversion', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: url,
                email: userEmail,
                transcribe_audio: transcribeAudio
            })
        });

        const data = await response.json();

        if (response.ok) {
            currentSessionId = data.session_id;
            
            // Show the main container, hide the download button initially
            document.getElementById('status-container').style.display = 'block';
            document.getElementById('download-container').style.display = 'none';

            // Start polling the server
            startPolling();
        } else {
            alert("Error: " + data.error);
        }
    } catch (error) {
        console.error("Failed to start conversion:", error);
        alert("A network error occurred. Please try again.");
    }
}

function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    
    // Poll immediately, then every 2 seconds
    pollServer();
    pollingInterval = setInterval(pollServer, 2000);
}

async function pollServer() {
    if (!currentSessionId) return;

    try {
        const response = await fetch(`/status/${currentSessionId}`);
        const data = await response.json();

        if (!response.ok) {
            console.error("Status error:", data.error);
            clearInterval(pollingInterval);
            return;
        }

        // ==========================================
        // KEY FIX: Toggle UI based on Queued vs Processing
        // ==========================================
        const queueContainer = document.getElementById('queue-info-container');
        const processingContainer = document.getElementById('processing-info-container');

        if (data.status === 'queued') {
            // Show queue info, hide processing info
            if (queueContainer) queueContainer.style.display = 'block';
            if (processingContainer) processingContainer.style.display = 'none';
            
            // Update queue metrics
            document.getElementById('queue-pos').innerText = data.queue_position;
            document.getElementById('wait-time').innerText = data.estimated_wait + " min";
            
        } else if (data.status === 'processing') {
            // Hide queue info, show processing info
            if (queueContainer) queueContainer.style.display = 'none';
            if (processingContainer) processingContainer.style.display = 'block';

            // Update processing metrics
            document.getElementById('current-track').innerText = `${data.completed + 1} of ${data.total}`;
            document.getElementById('sub-status').innerText = data.current_status;
            
            // Optional: Update a progress bar
            const progressPercent = ((data.completed / data.total) * 100) || 0;
            const progressBar = document.getElementById('progress-bar-fill');
            if (progressBar) progressBar.style.width = `${progressPercent}%`;
            
            if (data.current_thumbnail) {
                const thumbImg = document.getElementById('track-thumbnail');
                if (thumbImg) thumbImg.src = data.current_thumbnail;
            }
            
        } else if (data.status === 'completed') {
            // Job finished
            clearInterval(pollingInterval);
            
            if (queueContainer) queueContainer.style.display = 'none';
            if (processingContainer) processingContainer.style.display = 'none';
            
            const downloadContainer = document.getElementById('download-container');
            const downloadBtn = document.getElementById('download-btn');
            
            if (downloadContainer) downloadContainer.style.display = 'block';
            if (downloadBtn && data.zip_ready) {
                downloadBtn.href = data.zip_path;
            }
            
        } else if (data.status === 'error' || data.status === 'cancelled') {
            clearInterval(pollingInterval);
            alert(`Job ${data.status}. Please try again.`);
        }

    } catch (error) {
        console.error("Polling error:", error);
    }
}

// Example usage hook for your form
document.getElementById('conversion-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const url = document.getElementById('url-input').value;
    const email = document.getElementById('email-input').value;
    const transcribe = document.getElementById('transcribe-checkbox').checked;
    
    startConversion(url, email, transcribe);
});