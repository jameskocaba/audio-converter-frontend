document.addEventListener('DOMContentLoaded', () => {
    // ... (keep your existing element declarations) ...
    const resetBtn = document.getElementById('resetBtn');
    const urlInput = document.getElementById('urlInput');
    const statusDiv = document.getElementById('status');
    const downloadList = document.getElementById('downloadList');
    const downloadArea = document.getElementById('downloadArea');

    let currentSessionId = null;
    let downloadController = null;

    // --- Helper Functions ---
    const resetUI = () => {
        convertBtn.disabled = false;
        cancelBtn.classList.add('hidden');
        resetBtn.classList.remove('hidden'); 
        progressBar.classList.add('hidden');
        currentSessionId = null;
    };

    // The function that clears everything
    const fullReset = () => {
        // 1. If a conversion is running, stop it
        if (downloadController) {
            downloadController.abort();
        }
        
        // 2. Clear inputs and text
        urlInput.value = '';
        statusDiv.textContent = "Ready";
        
        // 3. Clear the download list and hide the area
        downloadList.innerHTML = '';
        downloadArea.classList.add('hidden');
        
        // 4. Fix button visibility
        resetUI();
        
        console.log("App reset to initial state.");
    };

    // --- ATTACH THE RESET EVENT ---
    resetBtn.addEventListener('click', fullReset);

    // ... (rest of your convertBtn and cancelBtn listeners) ...
});