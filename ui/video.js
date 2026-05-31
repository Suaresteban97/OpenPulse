// ui/video.js

document.addEventListener('DOMContentLoaded', () => {

    let videoQueue = [];
    let isProcessing = false;
    let currentProcessingId = null; 

    // --- Intro Overlay (primero, antes de cualquier cosa que pueda fallar) ---
    const introOverlay = document.getElementById('intro-overlay');
    if (introOverlay) { 
        setTimeout(() => { 
            introOverlay.style.opacity = '0'; 
            setTimeout(() => introOverlay.remove(), 500); 
        }, 2000); 
    }

    // --- APIs de Tauri (accedidas de forma segura) ---
    const invoke = (...args) => window.__TAURI__.core.invoke(...args);
    const listen = (...args) => window.__TAURI__.event.listen(...args);

    // --- 1. FUNCIÓN DE REFRESCO (Para el Sort) ---
    function refreshUIList() {
        const list = document.getElementById('video-list');
        if (!list) return;
        videoQueue.forEach(video => {
            const li = document.getElementById(`item-${video.id}`);
            if (li) list.appendChild(li); 
        });
    }

    // --- Menú de Navegación ---
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

    // --- Zona de Drop y Contenedor de Cola ---
    const dropZone = document.querySelector('#video-section .drop-zone');
    let queueContainer = document.getElementById('queue-container');
    if (!queueContainer && dropZone) {
        queueContainer = document.createElement('div');
        queueContainer.id = 'queue-container';
        queueContainer.style.marginTop = "20px";
        queueContainer.innerHTML = `
            <div id="controls-area" style="display:none; text-align:center; margin-bottom:20px;">
                <div style="margin-bottom:15px; padding-bottom:15px; border-bottom:1px solid #334155;">
                    <label style="color:#fbbf24; font-weight:bold; font-size:0.9rem;">Modo de Acción:</label>
                    <select id="mode-selector" style="padding: 8px; border-radius: 5px; background: #0f172a; color: #fbbf24; border: 1px solid #fbbf24; margin-left:10px; font-weight:bold;">
                        <option value="convert">🛠️ Convertir / Recortar (Individual)</option>
                        <option value="merge">🔗 Unir Vídeos (Fusión Rápida)</option>
                    </select>
                </div>
                <div id="format-group">
                    <label style="color:#94a3b8; font-size:0.9rem;">Formato de Salida:</label>
                    <select id="format-selector" style="padding: 8px; border-radius: 5px; background: #1e292b; color: white; border: 1px solid #334155; margin-left:10px;">
                        <option value="insta">📱 Instagram Reel (9:16)</option>
                        <option value="whatsapp">💬 WhatsApp (Ligero)</option>
                        <option value="original">📦 Original (Optimizado)</option>
                        <option value="gif">🎞️ GIF Animado</option>
                        <option value="audio">🎵 Solo Audio (MP3)</option>
                    </select>
                </div>
                <div style="margin-top:15px; position: relative; display: inline-block;">
                    <button id="btn-process-queue" style="padding:10px 20px; background:linear-gradient(45deg, #00f2ff, #0078d7); color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">⚡ EJECUTAR</button>
                    
                    <button id="btn-cancel-process" style="display:none; padding:10px 20px; background:#ef4444; color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">🛑 CANCELAR</button>
                    
                    <button id="btn-sort-queue" style="padding:10px 20px; background:#475569; color:white; border:none; border-radius:5px; cursor:pointer; margin-left:10px;">📅 ORGANIZAR</button>
                    <button id="btn-clear-queue" style="padding:10px 20px; background:#ef4444; color:white; border:none; border-radius:5px; cursor:pointer; margin-left:10px;">🗑️ LIMPIAR</button>
                </div>
            </div>
            <ul id="video-list" style="list-style:none; padding:0; width:90%; margin:0 auto;"></ul>
        `;
        dropZone.parentNode.insertBefore(queueContainer, dropZone.nextSibling);
    }

    const btnProcess = document.getElementById('btn-process-queue');
    const btnClear = document.getElementById('btn-clear-queue');
    const btnSort = document.getElementById('btn-sort-queue');
    const formatSelector = document.getElementById('format-selector');
    const modeSelector = document.getElementById('mode-selector');
    const formatGroup = document.getElementById('format-group');
    const btnCancel = document.getElementById('btn-cancel-process');

    function updateProcessButtonState() {
        if (!modeSelector || !btnProcess) return;
        const isMerge = modeSelector.value === 'merge';
        const hasErrors = videoQueue.some(v => v.errorMsg !== "");
        if (isMerge && hasErrors) {
            btnProcess.disabled = true;
            btnProcess.style.opacity = "0.5";
            btnProcess.style.cursor = "not-allowed";
        } else if (!isProcessing) {
            btnProcess.disabled = false;
            btnProcess.style.opacity = "1";
            btnProcess.style.cursor = "pointer";
        }
    }

    function toggleProcessingUI(processing) {
        isProcessing = processing;
        if (processing) {
            btnProcess.style.display = 'none';
            btnCancel.style.display = 'inline-block';
            btnSort.style.opacity = '0.5';
            btnSort.style.pointerEvents = 'none';
            btnClear.style.opacity = '0.5';
            btnClear.style.pointerEvents = 'none';
        } else {
            btnProcess.style.display = 'inline-block';
            btnCancel.style.display = 'none';
            btnSort.style.opacity = '1';
            btnSort.style.pointerEvents = 'auto';
            btnClear.style.opacity = '1';
            btnClear.style.pointerEvents = 'auto';
            btnProcess.innerText = "⚡ EJECUTAR";
            updateProcessButtonState();
        }
    }

    btnCancel.addEventListener('click', async () => {
        btnCancel.innerText = "⌛ Deteniendo...";
        btnCancel.disabled = true;
        try {
            await invoke('cancel_conversion');
        } catch (e) {
            console.error("Error al cancelar:", e);
        }
    });

    async function addFileToQueue(path) {
        if (videoQueue.some(v => v.path === path)) return;
        const isMergeMode = modeSelector && modeSelector.value === 'merge';
        const currentExt = path.split('.').pop().toLowerCase();
        const uniqueId = btoa(encodeURIComponent(path)).replace(/=/g, '');
        
        let durationParts = ["00", "00", "00"];
        let metadata = { width: 0, height: 0, codec: '', modified: 0 };
        let errorMsg = "";

        try {
            const meta = await invoke('get_video_metadata', { path: path });
            if (meta) {
                const clean = meta.duration.split('.')[0]; 
                durationParts = clean.split(':');
                metadata = meta;
            }
        } catch (e) { console.error(e); }

        videoQueue.push({
            path: path, id: uniqueId, start: "00:00:00", end: durationParts.join(':'),
            metadata: metadata, errorMsg: errorMsg, modified: metadata.modified || 0
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
                    <div id="btn-remove-${uniqueId}" style="cursor:pointer; margin-right:10px; color:#ef4444; font-weight:bold;">✕</div>
                    <button class="btn-edit" data-id="${uniqueId}" style="background:none; border:none; cursor:pointer; font-size:1.2rem; margin-right:5px; display:${isMergeMode ? 'none' : 'inline-block'};">✂️</button>
                    <div style="display:flex; flex-direction:column; overflow:hidden;">
                        <span style="color:white; font-size:0.9rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">📄 ${fileName}</span>
                    </div>
                </div>
                <span class="status-badge" style="color: #fbbf24; font-size:0.8rem; font-weight:bold;">⏳ Pendiente</span>
            </div>
            <div id="edit-area-${uniqueId}" style="display:none; margin-top:15px; padding-top:15px; border-top:1px solid #334155; font-size:0.8rem;">
                <div style="display:flex; gap:25px; align-items:flex-end; justify-content: center;">
                    <div style="display:flex; flex-direction:column; align-items:center;">
                        <span style="margin-bottom:8px; color:#94a3b8; font-weight:bold;">INICIO</span>
                        <div class="time-group start-group" data-id="${uniqueId}" style="display:flex; align-items:flex-end; gap:4px;">
                            <div style="display:flex; flex-direction:column; align-items:center;"><span style="${labelStyle}">Hrs</span><input type="number" min="0" value="00" class="t-h" style="${inputStyle}"></div>
                            <span style="padding-bottom:5px; color:#64748b;">:</span>
                            <div style="display:flex; flex-direction:column; align-items:center;"><span style="${labelStyle}">Min</span><input type="number" min="0" max="59" value="00" class="t-m" style="${inputStyle}"></div>
                            <span style="padding-bottom:5px; color:#64748b;">:</span>
                            <div style="display:flex; flex-direction:column; align-items:center;"><span style="${labelStyle}">Seg</span><input type="number" min="0" max="59" value="00" class="t-s" style="${inputStyle}"></div>
                        </div>
                    </div>
                    <span style="font-size:1.5rem; margin-bottom:5px; color:#3b82f6;">➜</span>
                    <div style="display:flex; flex-direction:column; align-items:center;">
                        <span style="margin-bottom:8px; color:#94a3b8; font-weight:bold;">FIN</span>
                        <div class="time-group end-group" data-id="${uniqueId}" style="display:flex; align-items:flex-end; gap:4px;">
                            <div style="display:flex; flex-direction:column; align-items:center;"><span style="${labelStyle}">Hrs</span><input type="number" min="0" value="${durationParts[0]}" class="t-h" style="${inputStyle}"></div>
                            <span style="padding-bottom:5px; color:#64748b;">:</span>
                            <div style="display:flex; flex-direction:column; align-items:center;"><span style="${labelStyle}">Min</span><input type="number" min="0" max="59" value="${durationParts[1]}" class="t-m" style="${inputStyle}"></div>
                            <span style="padding-bottom:5px; color:#64748b;">:</span>
                            <div style="display:flex; flex-direction:column; align-items:center;"><span style="${labelStyle}">Seg</span><input type="number" min="0" max="59" value="${durationParts[2]}" class="t-s" style="${inputStyle}"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        list.appendChild(li);

        // --- Eventos de Fila ---
        li.querySelector(`#btn-remove-${uniqueId}`).addEventListener('click', () => {
            li.remove();
            videoQueue = videoQueue.filter(v => v.id !== uniqueId);
            if (videoQueue.length === 0) document.getElementById('controls-area').style.display = 'none';
        });

        li.querySelector('.btn-edit').addEventListener('click', () => {
            const area = document.getElementById(`edit-area-${uniqueId}`);
            area.style.display = area.style.display === 'none' ? 'block' : 'none';
        });

        const updateTime = (isStart) => {
            const group = li.querySelector(isStart ? '.start-group' : '.end-group');
            const h = group.querySelector('.t-h').value.padStart(2, '0');
            const m = group.querySelector('.t-m').value.padStart(2, '0');
            const s = group.querySelector('.t-s').value.padStart(2, '0');
            const videoObj = videoQueue.find(v => v.id === uniqueId);
            if (videoObj) {
                if (isStart) videoObj.start = `${h}:${m}:${s}`;
                else videoObj.end = `${h}:${m}:${s}`;
            }
        };

        li.querySelectorAll('input[type="number"]').forEach(inp => {
            inp.addEventListener('input', (e) => updateTime(e.target.closest('.start-group') !== null));
        });

        updateProcessButtonState();
    }

    // --- Listener Organizar ---
    if (btnSort) {
        btnSort.addEventListener('click', (e) => {
            e.stopPropagation();
            if (videoQueue.length < 2) return;
            videoQueue.sort((a, b) => a.modified - b.modified);
            refreshUIList();
            btnSort.innerText = "✅ ORDENADO";
            setTimeout(() => btnSort.innerText = "📅 ORGANIZAR", 1500);
        });
    }

    // --- Otros Listeners (Merge, Process, Clear) ---
    if (modeSelector) {
        modeSelector.addEventListener('change', () => {
            const isMerge = modeSelector.value === 'merge';
            formatGroup.style.display = isMerge ? 'none' : 'block';
            document.querySelectorAll('.btn-edit').forEach(b => b.style.display = isMerge ? 'none' : 'inline-block');
        });
    }

    if (btnProcess) {
        btnProcess.addEventListener('click', async () => {
            if (videoQueue.length === 0) return;
            
            const mode = modeSelector.value;
            toggleProcessingUI(true);

            try {
                if (mode === 'merge') {
                    // MODO UNIR (Llamada única)
                    const paths = videoQueue.map(v => v.path);
                    const outputName = "Video_Unido_" + Date.now();
                    await invoke('merge_videos', { inputPaths: paths, outputName: outputName });
                    
                    // Actualizar todos los badges de la lista
                    videoQueue.forEach(v => {
                        const li = document.getElementById(`item-${v.id}`);
                        const status = li.querySelector('.status-badge');
                        status.innerText = "✅ Unido";
                        status.style.color = "#10b981";
                    });
                } else {
                    // MODO CONVERTIR (Loop individual)
                    for (const videoObj of videoQueue) {
                        // Si se canceló durante el proceso anterior, salimos del loop
                        if (!isProcessing) break; 

                        currentProcessingId = videoObj.id;
                        const li = document.getElementById(`item-${videoObj.id}`);
                        const status = li.querySelector('.status-badge');
                        status.innerText = "⚙️ Iniciando...";

                        await invoke('convert_file', { 
                            inputPath: videoObj.path, 
                            format: formatSelector.value,
                            startTime: videoObj.start, 
                            endTime: videoObj.end 
                        });

                        status.innerText = "✅ Listo";
                        status.style.color = "#10b981";
                    }
                }
            } catch (e) {
                console.log("Proceso detenido o error:", e);
                // Marcar el video actual como cancelado/error
                if (currentProcessingId) {
                    const li = document.getElementById(`item-${currentProcessingId}`);
                    const status = li.querySelector('.status-badge');
                    status.innerText = "🛑 Detenido";
                    status.style.color = "#ef4444";
                }
            } finally {
                btnCancel.disabled = false;
                btnCancel.innerText = "🛑 CANCELAR";
                toggleProcessingUI(false);
            }
        });
    }

    if (btnClear) {
        btnClear.addEventListener('click', () => {
            videoQueue = [];
            document.getElementById('video-list').innerHTML = "";
            document.getElementById('controls-area').style.display = 'none';
        });
    }

    // --- Listeners de Tauri ---
    listen('ffmpeg-progress', (event) => {
        if (currentProcessingId) {
            const li = document.getElementById(`item-${currentProcessingId}`);
            if (li) li.querySelector('.status-badge').innerText = `⚙️ ${event.payload}`;
        }
    });

    listen('tauri://file-drop', (event) => {
        event.payload.forEach(p => { if (p.match(/\.(mp4|mkv|avi|mov|flv|webm)$/i)) addFileToQueue(p); });
    });

    if (dropZone) {
        dropZone.addEventListener('click', async (e) => {
            if (isProcessing || e.target.closest('select, button')) return;
            const paths = await invoke('select_file', { fileType: 'video' });
            if (Array.isArray(paths)) paths.forEach(p => addFileToQueue(p));
        });
    }
});