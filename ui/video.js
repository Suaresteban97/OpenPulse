// ui/video.js

document.addEventListener('DOMContentLoaded', () => {
    const { invoke } = window.__TAURI__.core;
    const { listen } = window.__TAURI__.event;

    let videoQueue = [];
    let isProcessing = false;
    let currentProcessingId = null; 

    const introOverlay = document.getElementById('intro-overlay');
    if (introOverlay) { 
        setTimeout(() => { 
            introOverlay.style.opacity = '0'; 
            setTimeout(() => introOverlay.remove(), 500); 
        }, 2000); 
    }

    const menuItems = document.querySelectorAll('.menu-item');
    const sections = document.querySelectorAll('section');

    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            menuItems.forEach(i => i.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active-section'));
            item.classList.add('active');
            document.getElementById(item.dataset.target).classList.add('active-section');
        });
    });

    const dropZone = document.querySelector('#video-section .drop-zone');

    let queueContainer = document.getElementById('queue-container');
    if (!queueContainer && dropZone) {
        queueContainer = document.createElement('div');
        queueContainer.id = 'queue-container';
        queueContainer.style.marginTop = "20px";
        queueContainer.innerHTML = `
            <div id="controls-area" style="display:none; text-align:center; margin-bottom:20px;">
                 <label style="color:#94a3b8; font-size:0.9rem;">Formato para todos:</label>
                 <select id="format-selector" style="padding: 8px; border-radius: 5px; background: #1e293b; color: white; border: 1px solid #334155; margin-left:10px;">
                    <option value="insta">📱 Instagram Reel (9:16)</option>
                    <option value="whatsapp">💬 WhatsApp (Ligero)</option>
                    <option value="original">📦 Original (Optimizado)</option>
                    <option value="gif">🎞️ GIF Animado</option>
                    <option value="audio">🎵 Solo Audio (MP3)</option>
                </select>
                <div style="margin-top:15px;">
                    <button id="btn-process-queue" style="padding:10px 20px; background:linear-gradient(45deg, #00f2ff, #0078d7); color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">⚡ PROCESAR COLA</button>
                    <button id="btn-clear-queue" style="padding:10px 20px; background:#ef4444; color:white; border:none; border-radius:5px; cursor:pointer; margin-left:10px;">🗑️ LIMPIAR</button>
                </div>
            </div>
            <ul id="video-list" style="list-style:none; padding:0; width:90%; margin:0 auto;"></ul>
        `;
        dropZone.parentNode.insertBefore(queueContainer, dropZone.nextSibling);
    }

    const btnProcess = document.getElementById('btn-process-queue');
    const btnClear = document.getElementById('btn-clear-queue');
    const formatSelector = document.getElementById('format-selector');

    function addFileToQueue(path) {
        if (videoQueue.includes(path)) return;

        videoQueue.push(path);
        document.getElementById('controls-area').style.display = 'block';

        const list = document.getElementById('video-list');
        const li = document.createElement('li');
        
        const uniqueId = btoa(encodeURIComponent(path)).replace(/=/g, '');
        li.id = `item-${uniqueId}`;
        li.style.cssText = "background: rgba(255,255,255,0.05); margin-bottom: 8px; padding: 10px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;";

        const fileName = path.split(/[/\\]/).pop();

        li.innerHTML = `
            <span style="color:white; font-size:0.9rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:60%;" title="${path}">📄 ${fileName}</span>
            <span class="status-badge" style="color: #fbbf24; font-size:0.8rem; font-weight:bold; min-width: 100px; text-align: right;">⏳ Pendiente</span>
        `;
        
        list.appendChild(li);
    }

    listen('ffmpeg-progress', (event) => {
        if (currentProcessingId) {
            const timeString = event.payload; 
            const li = document.getElementById(`item-${currentProcessingId}`);
            if (li) {
                const badge = li.querySelector('.status-badge');
                badge.innerText = `⚙️ ${timeString}`;
                badge.style.color = "#3b82f6";
            }
        }
    });

    if (dropZone) {
        dropZone.addEventListener('click', async () => {
            if (isProcessing) return;
            try {
                const paths = await invoke('select_file', { fileType: 'video' });
                if (Array.isArray(paths) && paths.length > 0) {
                    paths.forEach(path => addFileToQueue(path));
                }
            } catch (err) {

            }
        });
    }

    if (btnProcess) {
        btnProcess.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (videoQueue.length === 0) return;
            
            isProcessing = true;
            btnProcess.disabled = true;
            btnProcess.innerText = "Procesando...";
            btnClear.style.display = 'none';

            const format = formatSelector.value;

            for (const filePath of videoQueue) {
                
                const uniqueId = btoa(encodeURIComponent(filePath)).replace(/=/g, '');
                currentProcessingId = uniqueId; 

                const li = document.getElementById(`item-${uniqueId}`);
                const statusSpan = li.querySelector('.status-badge');

                statusSpan.innerText = "Iniciando...";
                statusSpan.style.color = "#3b82f6"; 

                try {
                    await invoke('convert_file', { inputPath: filePath, format: format });

                    statusSpan.innerText = "✅ Listo";
                    statusSpan.style.color = "#10b981"; 
                    
                } catch (error) {
                    statusSpan.innerText = "❌ Error";
                    statusSpan.style.color = "#ef4444"; 
                    statusSpan.title = error;
                }
            }

            currentProcessingId = null;
            isProcessing = false;
            btnProcess.disabled = false;
            btnProcess.innerText = "⚡ PROCESAR COLA";
            btnClear.style.display = 'inline-block';

            if (window.playSound) window.playSound('success');
            alert("¡Proceso finalizado! Todos los videos han sido convertidos.");
        });
    }

    if (btnClear) {
        btnClear.addEventListener('click', (e) => {
            e.stopPropagation();
            videoQueue = [];
            document.getElementById('video-list').innerHTML = "";
            document.getElementById('controls-area').style.display = 'none';
        });
    }

    listen('tauri://file-drop', (event) => {
        const files = event.payload;
        if (files && files.length > 0) {
            files.forEach(p => {
                if (p.match(/\.(mp4|mkv|avi|mov|flv|webm)$/i)) addFileToQueue(p);
            });
        }
    });
});