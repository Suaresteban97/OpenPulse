// ui/main.js
document.addEventListener('DOMContentLoaded', () => {
    const menuItems = document.querySelectorAll('.menu-item');
    const sections = document.querySelectorAll('section');

    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetId = item.dataset.target;

            if (window.playSound) window.playSound('click');

            menuItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            sections.forEach(s => s.classList.remove('active-section'));
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.add('active-section');
            }

            if (targetId === 'audio-section') {
                document.body.classList.add('audio-mode');
            } else {
                document.body.classList.remove('audio-mode');
            }
        });
    });

    // Logs Modal Logic
    const btnViewLogs = document.getElementById('btn-view-logs');
    const btnCloseLogs = document.getElementById('btn-close-logs');
    const btnRefreshLogs = document.getElementById('btn-refresh-logs');
    const logsModal = document.getElementById('logs-modal');
    const logsContent = document.getElementById('logs-content');

    const loadLogs = async () => {
        try {
            const { invoke } = window.__TAURI__.core;
            const logs = await invoke('read_logs');
            logsContent.value = logs;
            logsContent.scrollTop = logsContent.scrollHeight;
        } catch (e) {
            logsContent.value = "Error al leer logs: " + e;
        }
    };

    if (btnViewLogs) {
        btnViewLogs.addEventListener('click', () => {
            logsModal.style.display = 'flex';
            loadLogs();
        });
    }

    if (btnCloseLogs) {
        btnCloseLogs.addEventListener('click', () => {
            logsModal.style.display = 'none';
        });
    }

    if (btnRefreshLogs) {
        btnRefreshLogs.addEventListener('click', loadLogs);
    }
});