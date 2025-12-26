// ui/audio.js
document.addEventListener('DOMContentLoaded', () => {
    const { invoke } = window.__TAURI__.core;
    const { listen } = window.__TAURI__.event;

    const audioDropZone = document.querySelector('#audio-section .drop-zone');
    let selectedAudioPath = "";
    let isProcessingAudio = false;

    if (audioDropZone) {
        audioDropZone.addEventListener('click', async (e) => {
            if (window.playSound) window.playSound('click');
            
            if (isProcessingAudio || selectedAudioPath !== "") return;

            try {
                audioDropZone.innerHTML = "<p>Abriendo selector de audio/video...</p>";

                const path = await invoke('select_file', { fileType: 'audio' });

                selectedAudioPath = path;

                audioDropZone.style.borderColor = "#ff00d4";
                audioDropZone.style.borderStyle = "solid";
                
                audioDropZone.innerHTML = `
                    <div style="text-align:center; width: 100%; cursor: default; position: relative; padding: 20px;">
                        <div id="btn-remove-audio" class="btn-cerrar-archivo" title="Quitar archivo">✕</div>
                        <p style="color: #ff00d4; margin-bottom:5px; font-weight:bold;">ARCHIVO CARGADO:</p>
                        <p style="font-size: 0.8rem; word-break: break-all; opacity: 0.8; margin-bottom: 20px;">${path}</p>
                        
                        <div id="audio-controls" style="margin-bottom: 20px;">
                            <label style="display:block; margin-bottom:5px; font-size:0.8rem; color:#94a3b8;">Formato de Audio:</label>
                            <select id="audio-format-selector" style="padding: 10px; border-radius: 5px; background: #1e293b; color: white; border: 1px solid #334155; width: 250px;">
                                <option value="mp3-high">🎵 MP3 Alta Calidad (320kbps)</option>
                                <option value="mp3-low">📉 MP3 Ligero (96kbps)</option>
                                <option value="wav">🎼 WAV (Sin pérdida / Editores)</option>
                                <option value="m4a">📱 M4A (Apple/AAC)</option>
                            </select>
                        </div>

                        <div id="audio-progress-wrapper" class="progress-container" style="display:none; margin: 0 auto 20px auto; width: 80%;">
                            <div id="audio-inner-bar" class="progress-bar" style="width: 0%; background: linear-gradient(90deg, #ff00d4, #7000ff);"></div>
                        </div>

                        <div id="audio-action-buttons" style="display:flex; gap:10px; justify-content:center;">
                            <button id="btn-convert-audio" style="padding:12px 24px; background:linear-gradient(45deg, #ff00d4, #7000ff); color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold; box-shadow: 0 0 15px rgba(255,0,212,0.3);">⚡ CONVERTIR AUDIO</button>
                            <button id="btn-cancel-audio" style="display:none; padding:12px 24px; background:#ef4444; color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">🛑 CANCELAR</button>
                        </div>
                        <div id="audio-status-message" style="margin-top:15px; font-size:0.8rem; height:20px; color: #94a3b8;"></div>
                    </div>
                `;

                const btnConvert = document.getElementById('btn-convert-audio');
                const btnCancel = document.getElementById('btn-cancel-audio');
                const btnRemove = document.getElementById('btn-remove-audio');
                const formatSelector = document.getElementById('audio-format-selector');
                const statusDiv = document.getElementById('audio-status-message');
                const progressWrapper = document.getElementById('audio-progress-wrapper');
                const innerBar = document.getElementById('audio-inner-bar');

                [btnConvert, btnCancel, btnRemove, formatSelector].forEach(el => {
                    el.addEventListener('click', (ev) => ev.stopPropagation());
                });

                btnRemove.addEventListener('click', () => {
                    if (window.playSound) window.playSound('click');
                    selectedAudioPath = "";
                    audioDropZone.innerHTML = "<p>Arrastra tu archivo de AUDIO aquí</p>";
                    audioDropZone.style.borderColor = "#334155";
                    audioDropZone.style.borderStyle = "dashed";
                });

                btnConvert.addEventListener('click', async () => {
                    isProcessingAudio = true;
                    btnConvert.style.display = "none";
                    btnRemove.style.display = "none";
                    btnCancel.style.display = "inline-block";
                    progressWrapper.style.display = "block";
                    innerBar.style.width = "10%";

                    statusDiv.innerText = "Extrayendo audio...";

                    try {
                        const result = await invoke('convert_file', {
                            inputPath: selectedAudioPath,
                            format: formatSelector.value
                        });

                        if (window.playSound) window.playSound('success');

                        innerBar.style.width = "100%";
                        statusDiv.innerText = "✅ " + result;
                        statusDiv.style.color = "#10b981";
                        btnCancel.style.display = "none";
                        btnRemove.style.display = "flex";
                        isProcessingAudio = false;

                    } catch (error) {
                        if (window.playSound) window.playSound('error');
                        statusDiv.innerText = "❌ Error: " + error;
                        progressWrapper.style.display = "none";
                        btnConvert.style.display = "inline-block";
                        btnCancel.style.display = "none";
                        btnRemove.style.display = "flex";
                        isProcessingAudio = false;
                    }
                });

                btnCancel.addEventListener('click', async () => {
                    if (window.playSound) window.playSound('click');
                    await invoke('cancel_conversion');
                });

                await listen('ffmpeg-progress', (event) => {
                    const timeString = event.payload;
                    statusDiv.innerText = `⏳ Extrayendo: ${timeString}`;
                    let currentWidth = parseFloat(innerBar.style.width);
                    if (currentWidth < 95) innerBar.style.width = (currentWidth + 5) + "%";
                });

            } catch (err) {
                if (window.playSound) window.playSound('error');
                audioDropZone.innerHTML = "<p>Arrastra tu archivo de AUDIO aquí</p>";
            }
        });
    }
});