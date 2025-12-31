document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('urlInput');
    const convertBtn = document.getElementById('convertBtn');
    const pasteBtn = document.getElementById('pasteBtn');
    const clearBtn = document.getElementById('clearBtn');
    const statusDiv = document.getElementById('status');
    const downloadArea = document.getElementById('downloadArea');
    const downloadList = document.getElementById('downloadList');

    const BACKEND_URL = 'https://audio-converter-backend.onrender.com'; 

    // Paste from clipboard
    pasteBtn.addEventListener('click', async () => {
        try {
            urlInput.value = await navigator.clipboard.readText();
        } catch (err) { alert("Please paste manually."); }
    });

    // Clear inputs and list
    clearBtn.addEventListener('click', () => {
        downloadList.innerHTML = '';
        downloadArea.classList.add('hidden');
        urlInput.value = '';
        statusDiv.textContent = "Ready";
    });

    // Main Conversion Logic
    convertBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) return;

        convertBtn.disabled = true;
        statusDiv.innerHTML = `<div class="spinner"></div><p>Converting tracks...</p>`;
        downloadArea.classList.add('hidden');

        try {
            const response = await fetch(`${BACKEND_URL}/convert`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url }),
            });
            const result = await response.json();

            if (result.status === "success") {
                statusDiv.innerHTML = `✅ ${result.tracks.length} track(s) ready.`;
                downloadArea.classList.remove('hidden');
                downloadList.innerHTML = ''; 

                if (result.zipLink) {
                    const zipA = document.createElement('a');
                    zipA.href = `${BACKEND_URL}${result.zipLink}`;
                    zipA.innerHTML = "<strong>DOWNLOAD ALL (ZIP)</strong>";
                    zipA.className = "zip-btn";
                    downloadList.appendChild(zipA);
                }

                result.tracks.forEach(t => {
                    const a = document.createElement('a');
                    a.href = `${BACKEND_URL}${t.downloadLink}`;
                    a.textContent = `⬇️ ${t.name}`;
                    a.className = "track-btn";
                    downloadList.appendChild(a);
                });

                if (result.skipped && result.skipped.length > 0) {
                    const skipLi = document.createElement('li');
                    skipLi.innerHTML = "<strong style='color:#ef4444'>⚠️ Unavailable:</strong>";
                    downloadList.appendChild(skipLi);
                    result.skipped.forEach(s => {
                        const li = document.createElement('li');
                        li.textContent = `🚫 ${s}`;
                        li.style.cssText = "font-size:12px; color:#64748b; margin-left:10px;";
                        downloadList.appendChild(li);
                    });
                }
            } else { statusDiv.textContent = "Error: " + result.message; }
        } catch (e) { statusDiv.textContent = "Server error."; }
        finally { convertBtn.disabled = false; }
    });
});

/** * MODAL SYSTEM 
 * Uses 'is-open' class for Flexbox centering
 */
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('is-open');
        document.body.style.overflow = 'hidden'; // Stop background scroll
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('is-open');
        document.body.style.overflow = 'auto'; // Restore background scroll
    }
}

// Global listener to close modal when clicking outside the content
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        closeModal(e.target.id);
    }
});