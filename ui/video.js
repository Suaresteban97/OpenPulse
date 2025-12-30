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

    async function addFileToQueue(path) {
        if (videoQueue.some(v => v.path === path)) return;

        const uniqueId = btoa(encodeURIComponent(path)).replace(/=/g, '');
        
        let durationParts = ["00", "00", "00"];
        try {
            const realDuration = await invoke('get_media_duration', { path: path });
            if (realDuration && realDuration !== "00:00:00") {
                const clean = realDuration.split('.')[0]; 
                durationParts = clean.split(':');
            }
        } catch (e) {
            console.error(e);
        }

        videoQueue.push({
            path: path,
            id: uniqueId,
            start: "00:00:00",
            end: durationParts.join(':')
        });

        document.getElementById('controls-area').style.display = 'block';

        const list = document.getElementById('video-list');
        const li = document.createElement('li');
        
        li.id = `item-${uniqueId}`;
        li.style.cssText = "background: rgba(255,255,255,0.05); margin-bottom: 8px; padding: 10px; border-radius: 6px; display: flex; flex-direction: column;";

        const fileName = path.split(/[/\\]/).pop();

        const inputStyle = "background:#0f172a; border:1px solid #334155; color:white; padding:4px; width:45px; text-align:center; border-radius:4px; font-family:monospace; font-size:1rem;";
        const labelStyle = "font-size:0.65rem; color:#64748b; margin-bottom:2px; text-transform:uppercase; letter-spacing:0.5px;";

        li.innerHTML = `
            <div style="display:flex; justify-content: space-between; align-items: center; width:100%;">
                <div style="display:flex; align-items:center; overflow:hidden; max-width:65%;">
                    <button class="btn-edit" data-id="${uniqueId}" style="background:none; border:none; cursor:pointer; font-size:1.2rem; margin-right:10px;" title="Recortar">✂️</button>
                    <span style="color:white; font-size:0.9rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${path}">📄 ${fileName}</span>
                </div>
                <span class="status-badge" style="color: #fbbf24; font-size:0.8rem; font-weight:bold; min-width: 100px; text-align: right;">⏳ Pendiente</span>
            </div>
            
            <div id="edit-area-${uniqueId}" style="display:none; margin-top:15px; padding-top:15px; border-top:1px solid #334155; font-size:0.8rem;">
                <div style="display:flex; gap:25px; align-items:flex-end; justify-content: center;">
                    
                    <div style="display:flex; flex-direction:column; align-items:center;">
                        <span style="margin-bottom:8px; color:#94a3b8; font-weight:bold;">INICIO</span>
                        <div class="time-group start-group" data-id="${uniqueId}" style="display:flex; align-items:flex-end; gap:4px;">
                            
                            <div style="display:flex; flex-direction:column; align-items:center;">
                                <span style="${labelStyle}">Hrs</span>
                                <input type="number" min="0" value="00" class="t-h" style="${inputStyle}">
                            </div>
                            <span style="padding-bottom:5px; color:#64748b;">:</span>
                            <div style="display:flex; flex-direction:column; align-items:center;">
                                <span style="${labelStyle}">Min</span>
                                <input type="number" min="0" max="59" value="00" class="t-m" style="${inputStyle}">
                            </div>
                            <span style="padding-bottom:5px; color:#64748b;">:</span>
                            <div style="display:flex; flex-direction:column; align-items:center;">
                                <span style="${labelStyle}">Seg</span>
                                <input type="number" min="0" max="59" value="00" class="t-s" style="${inputStyle}">
                            </div>

                        </div>
                    </div>

                    <span style="font-size:1.5rem; margin-bottom:5px; color:#3b82f6;">➜</span>

                    <div style="display:flex; flex-direction:column; align-items:center;">
                        <span style="margin-bottom:8px; color:#94a3b8; font-weight:bold;">FIN</span>
                        <div class="time-group end-group" data-id="${uniqueId}" style="display:flex; align-items:flex-end; gap:4px;">
                            
                            <div style="display:flex; flex-direction:column; align-items:center;">
                                <span style="${labelStyle}">Hrs</span>
                                <input type="number" min="0" value="${durationParts[0]}" class="t-h" style="${inputStyle}">
                            </div>
                            <span style="padding-bottom:5px; color:#64748b;">:</span>
                            <div style="display:flex; flex-direction:column; align-items:center;">
                                <span style="${labelStyle}">Min</span>
                                <input type="number" min="0" max="59" value="${durationParts[1]}" class="t-m" style="${inputStyle}">
                            </div>
                            <span style="padding-bottom:5px; color:#64748b;">:</span>
                            <div style="display:flex; flex-direction:column; align-items:center;">
                                <span style="${labelStyle}">Seg</span>
                                <input type="number" min="0" max="59" value="${durationParts[2]}" class="t-s" style="${inputStyle}">
                            </div>

                        </div>
                    </div>

                </div>
            </div>
        `;
        
        list.appendChild(li);

        const btnEdit = li.querySelector('.btn-edit');
        btnEdit.addEventListener('click', (e) => {
            e.stopPropagation();
            const area = document.getElementById(`edit-area-${uniqueId}`);
            area.style.display = area.style.display === 'none' ? 'block' : 'none';
        });

        const updateTimeObj = (groupType) => {
            const group = li.querySelector(`.${groupType}-group`);
            const h = group.querySelector('.t-h').value.padStart(2, '0');
            const m = group.querySelector('.t-m').value.padStart(2, '0');
            const s = group.querySelector('.t-s').value.padStart(2, '0');
            
            const timeStr = `${h}:${m}:${s}`;
            const videoObj = videoQueue.find(v => v.id === uniqueId);
            
            if (videoObj) {
                if (groupType === 'start') videoObj.start = timeStr;
                if (groupType === 'end') videoObj.end = timeStr;
            }
        };

        li.querySelectorAll('input[type="number"]').forEach(inp => {
            inp.addEventListener('input', (e) => {
                const isStart = e.target.parentElement.parentElement.classList.contains('start-group');
                updateTimeObj(isStart ? 'start' : 'end');
            });
            inp.addEventListener('click', e => e.stopPropagation());
        });
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
        dropZone.addEventListener('click', async (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
            if (isProcessing) return;
            try {
                const paths = await invoke('select_file', { fileType: 'video' });
                if (Array.isArray(paths) && paths.length > 0) {
                    paths.forEach(path => addFileToQueue(path));
                }
            } catch (err) {}
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

            for (const videoObj of videoQueue) {
                currentProcessingId = videoObj.id; 

                const li = document.getElementById(`item-${videoObj.id}`);
                const statusSpan = li.querySelector('.status-badge');
                const editArea = document.getElementById(`edit-area-${videoObj.id}`);
                if (editArea) editArea.style.display = 'none';

                statusSpan.innerText = "Iniciando...";
                statusSpan.style.color = "#3b82f6"; 

                try {
                    await invoke('convert_file', { 
                        inputPath: videoObj.path, 
                        format: format,
                        startTime: videoObj.start,
                        endTime: videoObj.end
                    });

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