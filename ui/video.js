// ui/script.js

document.addEventListener('DOMContentLoaded', () => {
    const { invoke } = window.__TAURI__.core;
    const { listen } = window.__TAURI__.event;

    // --- GLOBAL UI & NAVIGATION ---
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
            const targetId = item.dataset.target;
            document.getElementById(targetId).classList.add('active-section');
        });
    });

    // --- VIDEO SECTION LOGIC ---
    const dropZone = document.querySelector('#video-section .drop-zone');
    let selectedVideoPath = "";
    let isProcessing = false;

    if (dropZone) {
        dropZone.addEventListener('click', async (e) => {
            
            if (window.playSound) window.playSound('click');

            // Prevent clicks if processing, or if clicking children when file is loaded
            if (isProcessing || (e.target !== dropZone && !dropZone.contains(e.target)) || selectedVideoPath !== "") {
                return;
            }

            try {
                dropZone.innerHTML = "<p>Abriendo selector de video...</p>";
                
                // Matches Rust: select_file
                const path = await invoke('select_file', { fileType: 'video' });
                selectedVideoPath = path;

                if (window.playSound) window.playSound('click');

                // Update UI to "Loaded" state
                dropZone.style.borderColor = "#00f2ff";
                dropZone.style.borderStyle = "solid";
                
                // Note: IDs inside template string updated to English
                dropZone.innerHTML = `
                    <div id="container-inner" style="text-align:center; width: 100%; cursor: default; position: relative; padding: 20px;">
                        <div id="btn-remove-file" class="btn-cerrar-archivo" title="Quitar archivo">✕</div>
                        <p style="color: #00f2ff; margin-bottom:5px; font-weight:bold;">VIDEO CARGADO:</p>
                        <p style="font-size: 0.8rem; word-break: break-all; opacity: 0.8; margin-bottom: 20px;">${path}</p>
                        
                        <div id="controls-format" style="margin-bottom: 20px;">
                            <label style="display:block; margin-bottom:5px; font-size:0.8rem; color:#94a3b8;">Formato de Salida:</label>
                            <select id="format-selector" style="padding: 10px; border-radius: 5px; background: #1e293b; color: white; border: 1px solid #334155; width: 250px;">
                                <option value="insta">📱 Instagram Reel (9:16)</option>
                                <option value="whatsapp">💬 WhatsApp (Ligero)</option>
                                <option value="original">📦 Original (Optimizado)</option>
                                <option value="gif">🎞️ GIF Animado</option>
                                <option value="audio">🎵 Solo Audio (MP3)</option>
                            </select>
                        </div>

                        <div id="progress-wrapper" class="progress-container" style="display:none; margin: 0 auto 20px auto; width: 80%;">
                            <div id="inner-bar" class="progress-bar" style="width: 0%"></div>
                        </div>

                        <div id="action-buttons" style="display:flex; gap:10px; justify-content:center;">
                            <button id="btn-convert" style="padding:12px 24px; background:linear-gradient(45deg, #00f2ff, #0078d7); color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">⚡ CONVERTIR</button>
                            <button id="btn-cancel" style="display:none; padding:12px 24px; background:#ef4444; color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">🛑 CANCELAR</button>
                        </div>
                        <div id="status-message" style="margin-top:15px; font-size:0.8rem; height:20px; color: #94a3b8;"></div>
                    </div>
                `;

                // Bind new elements
                const btnConvert = document.getElementById('btn-convert');
                const btnCancel = document.getElementById('btn-cancel');
                const btnRemove = document.getElementById('btn-remove-file');
                const formatSelector = document.getElementById('format-selector');
                const statusDiv = document.getElementById('status-message');
                const progressWrapper = document.getElementById('progress-wrapper');
                const innerBar = document.getElementById('inner-bar');

                // Stop propagation to prevent re-opening file selector
                [btnConvert, btnCancel, btnRemove, formatSelector].forEach(el => {
                    el.addEventListener('click', (ev) => ev.stopPropagation());
                });

                // RESET ACTION
                btnRemove.addEventListener('click', () => {
                    if (window.playSound) window.playSound('click');
                    selectedVideoPath = "";
                    dropZone.innerHTML = "<p>Arrastra tu archivo de VIDEO aquí</p>";
                    dropZone.style.borderColor = "#334155";
                    dropZone.style.borderStyle = "dashed";
                });

                // CONVERT ACTION
                btnConvert.addEventListener('click', async () => {
                    if (window.playSound) window.playSound('click');
                    isProcessing = true;
                    
                    // UI Updates
                    btnConvert.style.display = "none";
                    btnRemove.style.display = "none";
                    btnCancel.style.display = "inline-block";
                    progressWrapper.style.display = "block";
                    innerBar.style.width = "5%";
                    statusDiv.innerText = "Iniciando motor...";

                    try {
                        // Matches Rust: convert_file(input_path, format)
                        // Tauri maps camelCase keys to snake_case args
                        const result = await invoke('convert_file', {
                            inputPath: selectedVideoPath,
                            format: formatSelector.value
                        });

                        if (window.playSound) window.playSound('success');

                        btnConvert.classList.add('success-pulse');
                        setTimeout(() => btnConvert.classList.remove('success-pulse'), 4500);

                        // Success State
                        innerBar.style.width = "100%";
                        statusDiv.innerText = "✅ " + result; // Keeps Spanish message for user
                        statusDiv.style.color = "#10b981";
                        btnCancel.style.display = "none";
                        btnRemove.style.display = "flex";
                        isProcessing = false;

                    } catch (error) {
                        if (window.playSound) window.playSound('error');
                        
                        if (error.includes("detenido") || error.includes("cancelado")) {
                            statusDiv.innerText = "⚠️ Proceso cancelado.";
                        } else {
                            statusDiv.innerText = "❌ Error: " + error;
                        }
                        
                        progressWrapper.style.display = "none";
                        btnConvert.style.display = "inline-block";
                        btnCancel.style.display = "none";
                        btnRemove.style.display = "flex";
                        isProcessing = false;
                    }
                });

                // CANCEL ACTION
                btnCancel.addEventListener('click', async () => {
                    if (window.playSound) window.playSound('click');
                    // Matches Rust: cancel_conversion
                    await invoke('cancel_conversion');
                });

                // LISTEN FOR RUST EVENTS
                await listen('ffmpeg-progress', (event) => {
                    const timeString = event.payload; // "00:00:05"
                    statusDiv.innerText = `⏳ Procesando tiempo: ${timeString}`;
                    
                    // Artificial visual increment
                    let currentWidth = parseFloat(innerBar.style.width);
                    if (currentWidth < 95) {
                        innerBar.style.width = (currentWidth + 2) + "%";
                    }
                });

            } catch (err) {
                // User cancelled file selection or error
                dropZone.innerHTML = "<p>Arrastra tu archivo de VIDEO aquí</p>";
            }
        });
    }
});