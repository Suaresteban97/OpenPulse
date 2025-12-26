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
});