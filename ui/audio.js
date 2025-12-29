document.addEventListener('DOMContentLoaded', () => {
    const { invoke } = window.__TAURI__.core;
    const { listen } = window.__TAURI__.event;

    let audioQueue = [];
    let isProcessingAudio = false;
    let currentAudioId = null;
    let currentTotalDuration = 0;
    let currentTotalString = "??:??:??";

    const audioDropZone = document.querySelector('#audio-section .drop-zone');

    function timeToSeconds(timeString) {
        const parts = timeString.split(':');
        const h = parseFloat(parts[0]);
        const m = parseFloat(parts[1]);
        const s = parseFloat(parts[2]);
        return (h * 3600) + (m * 60) + s;
    }

    let queueContainer = document.getElementById('audio-queue-container');
    if (!queueContainer && audioDropZone) {
        queueContainer = document.createElement('div');
        queueContainer.id = 'audio-queue-container';
        queueContainer.style.marginTop = "20px";
        queueContainer.innerHTML = `
            <div id="audio-controls-area" style="display:none; text-align:center; margin-bottom:20px;">
                 <label style="color:#94a3b8; font-size:0.9rem;">Formato de Salida:</label>
                 <select id="audio-format-selector" style="padding: 8px; border-radius: 5px; background: #1e293b; color: white; border: 1px solid #334155; margin-left:10px;">
                    <option value="mp3-high">🎵 MP3 Alta Calidad (320kbps)</option>
                    <option value="mp3-low">📉 MP3 Ligero (96kbps)</option>
                    <option value="wav">🎼 WAV (Sin pérdida)</option>
                    <option value="m4a">📱 M4A (Apple/AAC)</option>
                </select>
                <div style="margin-top:15px;">
                    <button id="btn-process-audio-queue" style="padding:10px 20px; background:linear-gradient(45deg, #ff00d4, #7000ff); color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold; box-shadow: 0 0 10px rgba(255,0,212,0.3);">⚡ CONVERTIR COLA</button>
                    <button id="btn-clear-audio-queue" style="padding:10px 20px; background:#ef4444; color:white; border:none; border-radius:5px; cursor:pointer; margin-left:10px;">🗑️ LIMPIAR</button>
                </div>
            </div>
            <ul id="audio-list" style="list-style:none; padding:0; width:90%; margin:0 auto;"></ul>
        `;
        audioDropZone.parentNode.insertBefore(queueContainer, audioDropZone.nextSibling);
    }

    const btnProcess = document.getElementById('btn-process-audio-queue');
    const btnClear = document.getElementById('btn-clear-audio-queue');
    const formatSelector = document.getElementById('audio-format-selector');

    function addFileToQueue(path) {
        if (audioQueue.includes(path)) return;

        audioQueue.push(path);
        document.getElementById('audio-controls-area').style.display = 'block';

        const list = document.getElementById('audio-list');
        const li = document.createElement('li');
        
        const uniqueId = btoa(encodeURIComponent(path)).replace(/=/g, '');
        li.id = `audio-item-${uniqueId}`;
        li.style.cssText = "background: rgba(255,255,255,0.05); margin-bottom: 8px; padding: 10px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;";

        const fileName = path.split(/[/\\]/).pop();

        li.innerHTML = `
            <span style="color:white; font-size:0.9rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:60%;" title="${path}">🎵 ${fileName}</span>
            <span class="status-badge" style="color: #fbbf24; font-size:0.8rem; font-weight:bold; min-width: 120px; text-align: right;">⏳ Pendiente</span>
        `;
        
        list.appendChild(li);
        if (window.playSound) window.playSound('click');
    }

    listen('video-total-duration', (event) => {
        if (currentAudioId) {
            currentTotalString = event.payload.split('.')[0];
            currentTotalDuration = timeToSeconds(event.payload);
        }
    });

    listen('ffmpeg-progress', (event) => {
        if (currentAudioId && currentTotalDuration > 0) {
            const timeString = event.payload;
            const currentSeconds = timeToSeconds(timeString);
            
            let percent = (currentSeconds / currentTotalDuration) * 100;
            if (percent > 100) percent = 100;

            const li = document.getElementById(`audio-item-${currentAudioId}`);
            if (li) {
                const badge = li.querySelector('.status-badge');
                const cleanCurrent = timeString.split('.')[0];
                badge.innerText = `${cleanCurrent} / ${currentTotalString}`;
                badge.style.color = "white"; 
                
                li.style.background = `linear-gradient(90deg, rgba(255, 0, 212, 0.4) ${percent}%, rgba(255,255,255,0.05) ${percent}%)`;
            }
        }
    });

    if (audioDropZone) {
        audioDropZone.addEventListener('click', async () => {
            if (isProcessingAudio) return;
            try {
                const paths = await invoke('select_file', { fileType: 'audio' });
                if (Array.isArray(paths) && paths.length > 0) {
                    paths.forEach(path => addFileToQueue(path));
                }
            } catch (err) {
                console.log("Cancelado");
            }
        });
    }

    listen('tauri://file-drop', (event) => {
        const files = event.payload;
        if (files && files.length > 0) {
            const audioSection = document.getElementById('audio-section');
            if (audioSection && audioSection.classList.contains('active-section')) {
                files.forEach(path => {
                   if (path.match(/\.(mp3|wav|m4a|flac|aac|ogg|wma|mp4|mkv|avi|mov|webm)$/i)) {
                        addFileToQueue(path);
                    }
                });
            }
        }
    });

    if (btnProcess) {
        btnProcess.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (audioQueue.length === 0) return;
            
            isProcessingAudio = true;
            btnProcess.disabled = true;
            btnProcess.innerText = "Procesando...";
            btnClear.style.display = 'none';

            const format = formatSelector.value;

            for (const filePath of audioQueue) {
                const uniqueId = btoa(encodeURIComponent(filePath)).replace(/=/g, '');
                currentAudioId = uniqueId; 
                currentTotalDuration = 0;
                currentTotalString = "...";

                const li = document.getElementById(`audio-item-${uniqueId}`);
                const statusSpan = li.querySelector('.status-badge');

                statusSpan.innerText = "Iniciando...";
                statusSpan.style.color = "#d946ef"; 

                try {
                    await invoke('convert_file', { inputPath: filePath, format: format });

                    statusSpan.innerText = "✅ Listo";
                    statusSpan.style.color = "#10b981"; 
                    
                } catch (error) {
                    console.error(error);
                    statusSpan.innerText = "❌ Error";
                    statusSpan.style.color = "#ef4444"; 
                    statusSpan.title = error;
                }
            }

            currentAudioId = null;
            isProcessingAudio = false;
            btnProcess.disabled = false;
            btnProcess.innerText = "⚡ CONVERTIR COLA";
            btnClear.style.display = 'inline-block';

            if (window.playSound) window.playSound('success');
            alert("¡Proceso de audio finalizado!");
        });
    }

    if (btnClear) {
        btnClear.addEventListener('click', (e) => {
            e.stopPropagation();
            audioQueue = [];
            document.getElementById('audio-list').innerHTML = "";
            document.getElementById('audio-controls-area').style.display = 'none';
        });
    }

    listen('tauri://file-drop-hover', () => {
        if (document.getElementById('audio-section').classList.contains('active-section')) {
            audioDropZone.style.borderColor = "#ff00d4";
            audioDropZone.style.backgroundColor = "rgba(255, 0, 212, 0.1)";
        }
    });

    listen('tauri://file-drop-cancelled', () => {
        audioDropZone.style.borderColor = "#334155";
        audioDropZone.style.backgroundColor = "transparent";
    });
});