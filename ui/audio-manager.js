const sounds = {
    click: new Audio('assets/sounds/click.mp3'),
    success: new Audio('assets/sounds/success.mp3')
};

window.playSound = (name) => {
    if (sounds[name]) {
        sounds[name].currentTime = 0;
        sounds[name].play().catch(e => console.warn("Audio bloqueado por el navegador:", e));
    }
};