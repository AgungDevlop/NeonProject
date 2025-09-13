(() => {
    let audio = null;
    let isPlaying = false;
    
    const toggleBtn = document.getElementById('music-toggle');
    
    function initAudio() {
        if (!audio) {
            audio = new Audio('sound.mp3');
            audio.loop = true;
            audio.volume = 0.7;
        }
    }
    
    function playMusic() {
        initAudio();
        audio.play().then(() => {
            isPlaying = true;
            toggleBtn.innerHTML = '<i class="fas fa-pause"></i>';
            toggleBtn.title = "Pause Music";
        }).catch(err => {
            console.log('Audio play failed:', err);
        });
    }
    
    function pauseMusic() {
        if (audio && isPlaying) {
            audio.pause();
            isPlaying = false;
            toggleBtn.innerHTML = '<i class="fas fa-play"></i>';
            toggleBtn.title = "Play Music";
        }
    }
    
    toggleBtn.addEventListener('click', () => {
        if (isPlaying) {
            pauseMusic();
        } else {
            playMusic();
        }
    });
    
    window.addEventListener('load', () => {
        setTimeout(playMusic, 1000);
    });
})();