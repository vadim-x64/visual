document.addEventListener("DOMContentLoaded", () => {
    const sidebar = document.querySelector(".sidebar");
    const footer = document.querySelector(".footer");
    const playlistSidebar = document.querySelector(".playlist-sidebar");
    const canvas = document.getElementById("background");
    const ctx = canvas.getContext("2d");
    const addMusicBtn = document.querySelector(".add-music");
    const playPauseBtn = document.querySelector(".play-pause");
    const repeatBtn = document.querySelector(".repeat-toggle");
    const autoplayBtn = document.querySelector(".autoplay-toggle");
    let isAutoplay = false;
    let repeatState = 0; // 0: вимкнено, 1: повторити 1 раз, 2: повторити 2 рази
    let repeatCount = 0;
    autoplayBtn.addEventListener("click", () => {
        if (playlist.length === 0) {
            return; // Не дозволяємо увімкнути автоплей, якщо плейлист порожній
        }
        isAutoplay = !isAutoplay;
        autoplayBtn.classList.toggle("active", isAutoplay);
        autoplayBtn.querySelector("i").className = isAutoplay ? "bi bi-infinity" : "bi bi-infinity";
        autoplayBtn.style.color = isAutoplay ? "#FFD700" : "#FFFFFF";

        if (isAutoplay && playlist.length > 0) {
            if (currentIndex === -1) {
                playTrack(0); // Почати відтворення першого треку
            } else if (isMusicLoaded && audio.paused) {
                audio.play();
                playPauseIcon.className = "bi bi-pause-fill";
                isVisualizationActive = true;
            }
        }
    });
    repeatBtn.addEventListener("click", () => {
        repeatState = (repeatState + 1) % 3; // Перемикання між 0, 1, 2
        updateRepeatIcon();
    });
    function updateRepeatIcon() {
        const icon = repeatBtn.querySelector("i");
        if (repeatState === 0) {
            icon.className = "bi bi-repeat";
            repeatBtn.style.color = "#FFFFFF";
        } else if (repeatState === 1) {
            icon.className = "bi bi-repeat-1";
            repeatBtn.style.color = "#FFD700";
        } else {
            icon.className = "bi bi-repeat-1";
            repeatBtn.style.color = "#FF4500";
        }
    }
    const musicInput = document.getElementById("music-input");
    const audio = document.getElementById("audio");
    const trackInfo = document.getElementById("track-info");
    const timeDisplay = document.getElementById("time-display");
    const timeline = document.getElementById("timeline");
    const animationSelect = document.getElementById("animation");
    const moonContainer = document.getElementById("moon-container");
    const playPauseIcon = document.querySelector(".play-pause i");
    const volumeIcon = document.querySelector(".volume-icon i");
    const playlistList = document.getElementById("playlist-list");
    const clearPlaylistBtn = document.getElementById("clear-playlist");
    let hideTimeout;
    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);
    let isMusicLoaded = false;
    let isUserSeeking = false;
    let audioContext, analyser, dataArray, source;
    let visualizationOpacity = 0;
    let isVisualizationActive = false;
    let currentAnimation = animationSelect.value;
    let targetAnimation = animationSelect.value;
    let transitionOpacity = 1;
    let playlist = [];
    let currentIndex = -1;
    let db;
    const volumeSlider = document.getElementById("volume");
    const savedVolume = localStorage.getItem("audioVolume");
    const initialVolume = savedVolume !== null ? parseFloat(savedVolume) : 100;
    volumeSlider.value = initialVolume;
    audio.volume = initialVolume / 100;
    updateVolumeIcon();
    volumeSlider.addEventListener("input", () => {
        const volumeValue = volumeSlider.value / 100;
        audio.volume = volumeValue;
        localStorage.setItem("audioVolume", volumeSlider.value);
        updateVolumeIcon(); // Оновити іконку
    });
    window.addEventListener("resize", () => {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
    });
    const dbRequest = indexedDB.open("MusicDB", 1);
    dbRequest.onerror = () => {
        console.error("IndexedDB error");
    };
    dbRequest.onsuccess = () => {
        db = dbRequest.result;
        loadPlaylist();
    };
    dbRequest.onupgradeneeded = (e) => {
        db = e.target.result;
        if (!db.objectStoreNames.contains("tracks")) {
            db.createObjectStore("tracks", { keyPath: "path" });
        }
    };
    function loadPlaylist() {
        if (!db) return;
        const tx = db.transaction(["tracks"], "readonly");
        const store = tx.objectStore("tracks");
        const req = store.getAll();
        req.onsuccess = (e) => {
            const tracks = e.target.result;
            playlist = tracks.map((t) => t.displayName);
            populatePlaylist();
            if (playlist.length > 0 && currentIndex === -1 && isAutoplay) {
                playTrack(0); // Auto-play first track if autoplay is enabled
            }
        };
    }
    function populatePlaylist() {
        playlistList.innerHTML = "";
        playlist.forEach((name, index) => {
            const li = document.createElement("li");
            // Додаємо іконку хрестика
            const deleteIcon = document.createElement("i");
            deleteIcon.className = "bi bi-x-circle";
            deleteIcon.style.marginRight = "10px";
            deleteIcon.style.cursor = "pointer";
            deleteIcon.addEventListener("click", (e) => {
                e.stopPropagation(); // Запобігаємо запуску відтворення треку
                deleteTrack(index);
            });

            li.appendChild(deleteIcon);
            li.appendChild(document.createTextNode(name));
            li.addEventListener("click", () => playTrack(index));
            if (index === currentIndex) {
                li.classList.add("current");
            }
            playlistList.appendChild(li);
        });
    }

    function deleteTrack(index) {
        if (!db || index < 0 || index >= playlist.length) return;

        const trackName = playlist[index];
        const tx = db.transaction(["tracks"], "readwrite");
        const store = tx.objectStore("tracks");
        store.delete(trackName);

        tx.oncomplete = () => {
            // Оновлюємо плейлист
            playlist.splice(index, 1);

            // Якщо видалений трек був поточним
            if (index === currentIndex) {
                audio.pause();
                if (audio.src) {
                    URL.revokeObjectURL(audio.src);
                    audio.src = "";
                }
                isMusicLoaded = false;
                trackInfo.classList.remove("visible");
                timeDisplay.classList.remove("visible");
                playPauseIcon.className = "bi bi-play-fill";
                isVisualizationActive = false;
                currentIndex = -1;
            } else if (index < currentIndex) {
                currentIndex--; // Оновлюємо індекс, якщо видалений трек був перед поточним
            }

            // Якщо плейлист порожній, вимикаємо автоплей
            if (playlist.length === 0 && isAutoplay) {
                isAutoplay = false;
                autoplayBtn.classList.remove("active");
                autoplayBtn.style.color = "#FFFFFF";
            }

            populatePlaylist(); // Оновлюємо відображення плейлиста
        };
    }
    function onAudioLoadedMetadata() {
        timeline.max = Math.floor(audio.duration);
        updateTimeDisplay();
        initAudioContext();
    }
    function playTrack(index) {
        if (currentIndex !== -1 && audio.src) {
            URL.revokeObjectURL(audio.src);
        }
        currentIndex = index;
        repeatCount = 0;
        const path = playlist[index];
        if (!db || !path) return;
        const tx = db.transaction(["tracks"], "readonly");
        const store = tx.objectStore("tracks");
        const req = store.get(path);
        req.onsuccess = () => {
            const track = req.result;
            if (track) {
                audio.src = URL.createObjectURL(track.blob);
                trackInfo.textContent = track.displayName;
                trackInfo.classList.add("visible");
                timeDisplay.classList.add("visible");
                isMusicLoaded = true;
                audio.addEventListener("loadedmetadata", onAudioLoadedMetadata, { once: true });

                audio.play();
                playPauseIcon.className = "bi bi-pause-fill";
                isVisualizationActive = true;

                populatePlaylist();
            }
        };
    }
    function initAudioContext() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 1024;
            dataArray = new Uint8Array(analyser.frequencyBinCount);
            source = audioContext.createMediaElementSource(audio);
            source.connect(analyser);
            analyser.connect(audioContext.destination);
        }
    }
    addMusicBtn.addEventListener("click", () => {
        musicInput.click();
    });
    musicInput.addEventListener("change", (e) => {
        const files = Array.from(e.target.files)
            .filter((f) => f.type.startsWith("audio/"))
            .sort((a, b) => a.name.localeCompare(b.name));
        if (files.length === 0) return;
        if (!db) return;
        const tx = db.transaction(["tracks"], "readwrite");
        const store = tx.objectStore("tracks");
        store.clear();
        files.forEach((file) => {
            store.put({
                path: file.name,
                displayName: file.name,
                blob: file
            });
        });
        tx.oncomplete = () => {
            loadPlaylist();
        };
    });
    clearPlaylistBtn.addEventListener("click", () => {
        if (!db) return;
        const tx = db.transaction(["tracks"], "readwrite");
        const store = tx.objectStore("tracks");
        store.clear();
        tx.oncomplete = () => {
            playlist = [];
            currentIndex = -1;
            populatePlaylist();
            if (audio.src) {
                URL.revokeObjectURL(audio.src);
                audio.pause();
                audio.src = "";
            }
            isMusicLoaded = false;
            trackInfo.classList.remove("visible");
            timeDisplay.classList.remove("visible");
            playPauseIcon.className = "bi bi-play-fill";
            isVisualizationActive = false;

            if (isAutoplay) {
                isAutoplay = false;
                autoplayBtn.classList.remove("active");
                autoplayBtn.style.color = "#FFFFFF";
            }
        };
    });
    playPauseBtn.addEventListener("click", () => {
        if (!isMusicLoaded) return;

        if (!audioContext) {
            initAudioContext();
        }

        if (audio.paused) {
            audio.play();
            playPauseIcon.className = "bi bi-pause-fill"; // Змінити на "пауза"
            isVisualizationActive = true;
        } else {
            audio.pause();
            playPauseIcon.className = "bi bi-play-fill"; // Змінити на "плей"
            isVisualizationActive = false;
        }
    });
    audio.addEventListener("timeupdate", () => {
        if (!isUserSeeking) {
            timeline.value = Math.floor(audio.currentTime);
            updateTimeDisplay();
        }
    });
    audio.addEventListener("ended", () => {
        audio.pause();
        timeline.value = timeline.max;
        updateTimeDisplay();
        isVisualizationActive = false;
        playPauseIcon.className = "bi bi-play-fill"; // Повернути іконку "плей"
        if (repeatState > 0 && repeatCount < repeatState) {
            repeatCount++;
            audio.currentTime = 0;
            audio.play();
            playPauseIcon.className = "bi bi-pause-fill";
            isVisualizationActive = true;
        } else if (isAutoplay && currentIndex < playlist.length - 1) {
            playTrack(currentIndex + 1);
            setTimeout(() => {
                audio.play();
                playPauseIcon.className = "bi bi-pause-fill";
            }, 500);
        }
    });
    function updateTimeDisplay() {
        const current = formatTime(timeline.value || 0);
        const duration = formatTime(audio.duration || 0);
        timeDisplay.textContent = `${current} / ${duration}`;
    }
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    function updateVolumeIcon() {
        if (audio.volume === 0) {
            volumeIcon.className = "bi bi-volume-mute-fill";
        } else {
            volumeIcon.className = "bi bi-volume-up-fill";
        }
    }
    timeline.addEventListener("input", () => {
        isUserSeeking = true;
        updateTimeDisplay();
    });
    timeline.addEventListener("change", () => {
        audio.currentTime = timeline.value;
        isUserSeeking = false;
    });
    class Blob {
        constructor(x, y, r, color) {
            this.x = x;
            this.y = y;
            this.r = r;
            this.color = color;
            this.vx = (Math.random() - 0.5) * 1.7;
            this.vy = (Math.random() - 0.5) * 1.7;
        }
        update() {
            this.x += this.vx;
            this.y += this.vy;
            if (this.x < this.r || this.x > w - this.r) this.vx *= -1;
            if (this.y < this.r || this.y > h - this.r) this.vy *= -1;
        }

        draw(ctx) {
            const gradient = ctx.createRadialGradient(
                this.x, this.y, this.r * 0.2,
                this.x, this.y, this.r
            );
            gradient.addColorStop(0, this.color);
            gradient.addColorStop(1, "transparent");
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    const colors = ["#7b5cff", "#00baff"];
    const blobs = [];
    for (let i = 0; i < 5; i++) {
        const r = 300 + Math.random() * 150;
        const x = Math.random() * w;
        const y = Math.random() * h;
        const color = colors[i % colors.length];
        blobs.push(new Blob(x, y, r, color));
    }
    class MusicOrb {
        constructor(angle, distance) {
            this.angle = angle;
            this.baseDistance = distance;
            this.distance = distance;
            this.size = 8 + Math.random() * 15;
            this.baseSize = this.size;
            this.targetSize = this.size;
            this.currentSize = this.size;
            this.hue = Math.random() * 360;
            this.pulsePhase = Math.random() * Math.PI * 2;
            this.orbitSpeed = (Math.random() - 0.5) * 0.03;
            this.frequencyIndex = Math.floor(Math.random() * 32);
            this.trail = [];
            this.maxTrailLength = 20;
        }
        update(audioData, bassLevel, time) {
            this.angle += this.orbitSpeed + bassLevel * 0.02;
            const freqValue = audioData[this.frequencyIndex] / 255;
            this.targetSize = this.baseSize + freqValue * 60;
            this.currentSize += (this.targetSize - this.currentSize) * 0.3;
            this.distance = this.baseDistance + bassLevel * 120 + Math.sin(time * 0.05 + this.pulsePhase) * 30;
            this.hue = (this.hue + freqValue * 5 + 0.5) % 360;
            const x = w / 2 + Math.cos(this.angle) * this.distance;
            const y = h / 2 + Math.sin(this.angle) * this.distance;
            this.trail.push({ x, y, size: this.currentSize, hue: this.hue });
            if (this.trail.length > this.maxTrailLength) {
                this.trail.shift();
            }
        }
        draw(ctx, centerX, centerY, opacity) {
            this.trail.forEach((point, index) => {
                const trailOpacity = (index / this.trail.length) * opacity * 0.3;
                const trailSize = point.size * (index / this.trail.length);
                const gradient = ctx.createRadialGradient(
                    point.x, point.y, 0,
                    point.x, point.y, trailSize
                );
                gradient.addColorStop(0, `hsla(${point.hue}, 100%, 60%, ${trailOpacity})`);
                gradient.addColorStop(1, `hsla(${point.hue}, 100%, 30%, 0)`);
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(point.x, point.y, trailSize, 0, Math.PI * 2);
                ctx.fill();
            });
            const x = centerX + Math.cos(this.angle) * this.distance;
            const y = centerY + Math.sin(this.angle) * this.distance;
            for (let i = 3; i > 0; i--) {
                const layerSize = this.currentSize * (1 + i * 0.3);
                const gradient = ctx.createRadialGradient(x, y, 0, x, y, layerSize);
                gradient.addColorStop(0, `hsla(${this.hue}, 100%, 70%, ${opacity * (0.8 / i)})`);
                gradient.addColorStop(0.4, `hsla(${this.hue}, 100%, 60%, ${opacity * (0.5 / i)})`);
                gradient.addColorStop(1, `hsla(${this.hue}, 100%, 40%, 0)`);
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(x, y, layerSize, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.fillStyle = `hsla(${this.hue}, 100%, 90%, ${opacity})`;
            ctx.beginPath();
            ctx.arc(x, y, this.currentSize * 0.3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    class DentingOrb {
        constructor(index, total) {
            this.angle = (index / total) * Math.PI * 2;
            this.baseRadius = 40 + Math.random() * 15;
            this.dentFactor = 0;
            this.hue = 200 + Math.random() * 50;
            this.rotation = Math.random() * Math.PI * 2;
        }
        update(bassLevel) {
            const targetDent = bassLevel * 0.7;
            this.dentFactor += (targetDent - this.dentFactor) * 0.2;
            this.angle += 0.002 + bassLevel * 0.005;
        }

        draw(ctx, centerX, centerY, mainRingRadius, opacity) {
            const x = centerX + Math.cos(this.angle) * mainRingRadius;
            const y = centerY + Math.sin(this.angle) * mainRingRadius;
            const radius = this.baseRadius * (1 - this.dentFactor * 0.4);
            ctx.shadowBlur = 30 + this.dentFactor * 50;
            ctx.shadowColor = `hsla(${this.hue}, 100%, 70%, ${opacity * 0.7})`;
            const gradient = ctx.createRadialGradient(
                x - radius * 0.2, y - radius * 0.2, radius * 0.1,
                x, y, radius
            );
            gradient.addColorStop(0, `hsla(${this.hue}, 100%, 85%, ${opacity})`);
            gradient.addColorStop(0.7, `hsla(${this.hue - 20}, 100%, 60%, ${opacity})`);
            gradient.addColorStop(1, `hsla(${this.hue - 40}, 100%, 40%, ${opacity})`);
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
            if (this.dentFactor > 0.05) {
                const dentGradient = ctx.createRadialGradient(
                    x, y, 0,
                    x, y, radius
                );
                dentGradient.addColorStop(0, `hsla(0, 0%, 0%, 0)`);
                dentGradient.addColorStop(0.8, `hsla(0, 0%, 0%, 0)`);
                dentGradient.addColorStop(1, `hsla(${this.hue - 60}, 100%, 20%, ${opacity * this.dentFactor})`);
                ctx.fillStyle = dentGradient;
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.shadowBlur = 0;
        }
    }
    class WaveVisualization {
        constructor() {
            this.points = 128;
            this.waves = 3;
        }
        draw(ctx, audioData, opacity) {
            const centerY = h / 2;
            const amplitude = 200;
            for (let w = 0; w < this.waves; w++) {
                ctx.beginPath();
                const hue = (180 + w * 60 + time * 2) % 360;
                ctx.strokeStyle = `hsla(${hue}, 100%, 50%, ${opacity * (1 - w * 0.3)})`;
                ctx.lineWidth = 5 - w;
                ctx.lineCap = 'round';
                ctx.shadowBlur = 20;
                ctx.shadowColor = `hsla(${hue}, 100%, 50%, ${opacity * 0.5})`;
                for (let i = 0; i < this.points; i++) {
                    const x = (i / this.points) * canvas.width;
                    const audioIndex = Math.floor((i / this.points) * audioData.length);
                    const audioValue = audioData[audioIndex] / 255;
                    const y = centerY + Math.sin(i * 0.1 + time * 0.05 + w * 0.5) * amplitude * audioValue;
                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                ctx.stroke();
                ctx.shadowBlur = 0;
            }
        }
    }
    class BarVisualization {
        constructor() {
            this.barCount = 64;
            this.bars = [];
            for (let i = 0; i < this.barCount; i++) {
                this.bars.push({
                    currentUpperHeight: 0,
                    targetUpperHeight: 0,
                    currentLowerHeight: 0,
                    targetLowerHeight: 0,
                    color: this.getBarColor(i),
                    glow: 0,
                    targetGlow: 0
                });
            }
        }
        getBarColor(index) {
            const position = index / this.barCount;
            const hue = 240 - (position * 240);
            return { h: hue, s: 100, l: 65 };
        }
        draw(ctx, audioData, opacity) {
            const visualizerWidth = w * 0.6;
            const startX = (w - visualizerWidth) / 2;
            const barWidth = visualizerWidth / this.barCount;
            const barSpacing = barWidth * 0.2;
            const effectiveBarWidth = barWidth - barSpacing;
            const maxHeight = h * 0.4;
            const centerY = h / 2;
            ctx.globalAlpha = opacity;
            for (let i = 0; i < this.barCount; i++) {
                const bar = this.bars[i];
                const x = startX + i * barWidth;
                const upperValue = audioData[Math.floor((i / this.barCount) * (audioData.length / 4))] / 255;
                const lowerValue = audioData[Math.floor((i / this.barCount) * (audioData.length / 2))] / 255;
                bar.targetUpperHeight = upperValue * maxHeight;
                bar.currentUpperHeight += (bar.targetUpperHeight - bar.currentUpperHeight) * 0.35;
                bar.targetLowerHeight = lowerValue * maxHeight;
                bar.currentLowerHeight += (bar.targetLowerHeight - bar.currentLowerHeight) * 0.35;
                bar.targetGlow = Math.min(1, (upperValue + lowerValue) * 0.8);
                bar.glow += (bar.targetGlow - bar.glow) * 0.3;
                bar.color.h = (bar.color.h + bar.glow * 0.5) % 360;
                const currentHue = bar.color.h;
                ctx.shadowBlur = 30 + bar.glow * 100;
                ctx.shadowColor = `hsla(${currentHue}, 100%, 75%, ${bar.glow * 0.7})`;
                if (bar.currentUpperHeight > 1) {
                    const gradient = ctx.createLinearGradient(x, centerY, x, centerY - bar.currentUpperHeight);
                    gradient.addColorStop(0, `hsla(${currentHue}, 100%, 65%, 1)`);
                    gradient.addColorStop(1, `hsla(${currentHue}, 100%, 85%, 1)`);
                    ctx.fillStyle = gradient;
                    ctx.fillRect(x, centerY - bar.currentUpperHeight, effectiveBarWidth, bar.currentUpperHeight + 1);
                }
                if (bar.currentLowerHeight > 1) {
                    const gradient = ctx.createLinearGradient(x, centerY, x, centerY + bar.currentLowerHeight);
                    gradient.addColorStop(0, `hsla(${currentHue}, 100%, 65%, 1)`);
                    gradient.addColorStop(1, `hsla(${currentHue}, 100%, 85%, 1)`);
                    ctx.fillStyle = gradient;
                    ctx.fillRect(x, centerY, effectiveBarWidth, bar.currentLowerHeight);
                    const reflectionHeight = bar.currentLowerHeight * 0.5;
                    const reflectionGradient = ctx.createLinearGradient(x, centerY + bar.currentLowerHeight, x, centerY + bar.currentLowerHeight + reflectionHeight);
                    reflectionGradient.addColorStop(0, `hsla(${currentHue}, 100%, 65%, ${bar.glow * 0.4})`);
                    reflectionGradient.addColorStop(1, `hsla(${currentHue}, 100%, 65%, 0)`);
                    ctx.fillStyle = reflectionGradient;
                    ctx.fillRect(x, centerY + bar.currentLowerHeight, effectiveBarWidth, reflectionHeight);
                }
            }
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
        }
    }
    class Particle {
        constructor() {
            this.x = w / 2;
            this.y = h / 2;
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 8;
            this.vx = Math.cos(angle) * speed;
            this.vy = Math.sin(angle) * speed;
            this.size = 2 + Math.random() * 3;
            this.life = 1;
            this.hue = 200 + Math.random() * 60;
        }
        update() {
            this.x += this.vx;
            this.y += this.vy;
            this.life -= 0.01;
        }
        draw(ctx) {
            ctx.fillStyle = `hsla(${this.hue}, 100%, 75%, ${this.life})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    class Star {
        constructor() {
            this.x = Math.random() * w;
            this.y = Math.random() * h;
            this.size = 0.5 + Math.random() * 1.5;
            this.opacity = 0.2 + Math.random() * 0.5;
            this.flickerSpeed = Math.random() * 0.03;
        }
        draw(ctx) {
            const currentOpacity = this.opacity * (0.6 + Math.sin(Date.now() * this.flickerSpeed) * 0.4);
            ctx.fillStyle = `hsla(220, 100%, 95%, ${currentOpacity})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    class Comet {
        constructor() {
            this.x = Math.random() * w;
            this.y = -20;
            this.vx = (Math.random() - 0.5) * 4;
            this.vy = 2 + Math.random() * 3;
            this.size = 1.5 + Math.random();
            this.life = 1;
            this.tailLength = 15;
            this.history = [];
        }
        update() {
            this.history.push({ x: this.x, y: this.y });
            if (this.history.length > this.tailLength) {
                this.history.shift();
            }
            this.x += this.vx;
            this.y += this.vy;
            if (this.x < -50 || this.x > w + 50 || this.y > h + 50) {
                this.life = 0;
            }
        }
        draw(ctx) {
            if (this.history.length > 1) {
                const gradient = ctx.createLinearGradient(this.x, this.y, this.history[0].x, this.history[0].y);
                gradient.addColorStop(0, `hsla(220, 100%, 95%, 0.7)`);
                gradient.addColorStop(1, `hsla(220, 100%, 95%, 0)`);
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(this.history[0].x, this.history[0].y);
                ctx.strokeStyle = gradient;
                ctx.lineWidth = this.size;
                ctx.stroke();
            }
        }
    }
    class Shockwave {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.radius = 20;
            this.maxRadius = 350;
            this.life = 1;
            this.hue = 240;
        }
        update() {
            this.radius += (this.maxRadius - this.radius) * 0.07;
            this.life -= 0.025;
        }
        draw(ctx) {
            if (this.life <= 0) return;
            ctx.strokeStyle = `hsla(${this.hue}, 100%, 80%, ${this.life * 0.8})`;
            ctx.lineWidth = 3;
            ctx.shadowBlur = 25;
            ctx.shadowColor = `hsla(${this.hue}, 100%, 70%, ${this.life})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
    }
    class CosmicRiftVisualization {
        constructor() {
            this.particles = [];
            this.stars = [];
            this.shockwaves = [];
            this.comets = [];
            this.nextCometSpawnTime = 0;
            for (let i = 0; i < 200; i++) {
                this.stars.push(new Star());
            }
        }
        draw(ctx, audioData, opacity, time) {
            const bassSum = audioData.slice(0, 16).reduce((a, b) => a + b, 0);
            const bassLevel = bassSum / (16 * 255);
            const highSum = audioData.slice(100, 200).reduce((a, b) => a + b, 0);
            const highLevel = highSum / (100 * 255);
            ctx.globalCompositeOperation = "source-over";
            this.stars.forEach(star => star.draw(ctx));
            if (time > this.nextCometSpawnTime) {
                this.comets.push(new Comet());
                this.nextCometSpawnTime = time + 300 + Math.random() * 200;
            }
            for (let i = this.comets.length - 1; i >= 0; i--) {
                const comet = this.comets[i];
                comet.update();
                comet.draw(ctx);
                if (comet.life <= 0) {
                    this.comets.splice(i, 1);
                }
            }
            if (bassLevel > 0.7 && Math.random() < 0.2) {
                this.shockwaves.push(new Shockwave(w / 2, h / 2));
            }
            ctx.globalCompositeOperation = "lighter";
            for (let i = this.shockwaves.length - 1; i >= 0; i--) {
                const sw = this.shockwaves[i];
                sw.update();
                sw.draw(ctx);
                if (sw.life <= 0) {
                    this.shockwaves.splice(i, 1);
                }
            }
            if (Math.random() < highLevel * 0.8) {
                for (let i = 0; i < Math.floor(highLevel * 5); i++) {
                    this.particles.push(new Particle());
                }
            }
            ctx.globalCompositeOperation = "lighter";
            for (let i = this.particles.length - 1; i >= 0; i--) {
                const p = this.particles[i];
                p.update();
                p.draw(ctx);
                if (p.life <= 0) {
                    this.particles.splice(i, 1);
                }
            }
            if (opacity > 0) {
                const coreRadius = 20 + bassLevel * 150 + Math.sin(time * 0.1) * 10;
                const coreHue = (250 + time) % 360;
                for (let i = 4; i > 0; i--) {
                    const layerRadius = coreRadius * (1 + i * 0.5);
                    const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, layerRadius);
                    gradient.addColorStop(0, `hsla(${coreHue}, 100%, 80%, ${opacity * 0.05 * bassLevel * i})`);
                    gradient.addColorStop(0.2, `hsla(${coreHue}, 100%, 70%, ${opacity * 0.1 * i})`);
                    gradient.addColorStop(1, `hsla(${coreHue}, 100%, 50%, 0)`);
                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.arc(w / 2, h / 2, layerRadius, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }
    const orbs = [];
    for (let i = 0; i < 36; i++) {
        const angle = (i / 36) * Math.PI * 2;
        const distance = 120 + Math.random() * 180;
        orbs.push(new MusicOrb(angle, distance));
    }
    const dentingOrbs = [];
    const numDentingOrbs = 10;
    for (let i = 0; i < numDentingOrbs; i++) {
        dentingOrbs.push(new DentingOrb(i, numDentingOrbs));
    }
    const waveViz = new WaveVisualization();
    animationSelect.addEventListener("change", () => {
        const newAnimation = animationSelect.value;
        if (newAnimation !== currentAnimation) {
            targetAnimation = newAnimation;
            if (!isVisualizationActive || visualizationOpacity <= 0) {
                currentAnimation = targetAnimation;
                transitionOpacity = 1;
            }
        }
    });
    const barViz = new BarVisualization();
    const cosmicViz = new CosmicRiftVisualization();
    let time = 0;
    let smoothedBassLevel = 0;
    function animate() {
        ctx.clearRect(0, 0, w, h);
        ctx.globalCompositeOperation = "lighter";
        ctx.filter = "blur(150px)";
        for (let blob of blobs) {
            blob.update();
            blob.draw(ctx);
        }
        ctx.filter = "none";
        if (analyser && isMusicLoaded) {
            if (isVisualizationActive && visualizationOpacity < 1) {
                visualizationOpacity += 0.02;
            } else if (!isVisualizationActive && visualizationOpacity > 0) {
                visualizationOpacity -= 0.02;
            }
            if (visualizationOpacity > 0) {
                analyser.getByteFrequencyData(dataArray);
                const bassSum = dataArray.slice(0, 16).reduce((a, b) => a + b, 0);
                const bassLevel = bassSum / (16 * 255);
                smoothedBassLevel += (bassLevel - smoothedBassLevel) * 0.1;
                const transitionSpeed = 0.04;
                if (currentAnimation !== targetAnimation) {
                    transitionOpacity -= transitionSpeed;
                    if (transitionOpacity <= 0) {
                        transitionOpacity = 0;
                        currentAnimation = targetAnimation;
                    }
                } else if (transitionOpacity < 1) {
                    transitionOpacity += transitionSpeed;
                    if (transitionOpacity > 1) transitionOpacity = 1;
                }
                const finalOpacity = visualizationOpacity * transitionOpacity;
                switch (currentAnimation) {
                    case "circle":
                        ctx.globalCompositeOperation = "lighter";
                        const centerX = w / 2;
                        const centerY = h / 2;
                        const mainRingRadius = 150 + smoothedBassLevel * 80;
                        dentingOrbs.forEach(orb => {
                            orb.update(smoothedBassLevel);
                            orb.draw(ctx, centerX, centerY, mainRingRadius, finalOpacity);
                        });
                        orbs.forEach(orb => {
                            orb.update(dataArray, smoothedBassLevel, time);
                            orb.draw(ctx, centerX, centerY, finalOpacity);
                        });
                        break;
                    case "waves":
                        ctx.globalCompositeOperation = "screen";
                        waveViz.draw(ctx, dataArray, finalOpacity);
                        break;
                    case "lines":
                        ctx.globalCompositeOperation = "source-over";
                        barViz.draw(ctx, dataArray, finalOpacity);
                        break;
                    case "cosmic":
                        ctx.globalCompositeOperation = "source-over";
                        cosmicViz.draw(ctx, dataArray, finalOpacity, time);
                        break;
                }
                time += 1;
            }
        }
        if (currentAnimation === 'cosmic' && isVisualizationActive && visualizationOpacity > 0.05) {
            moonContainer.classList.add('visible');
        } else {
            moonContainer.classList.remove('visible');
        }
        ctx.globalCompositeOperation = "source-over";
        requestAnimationFrame(animate);
    }
    animate();
    function showControls() {
        sidebar.classList.add("visible");
        footer.classList.add("visible");
        playlistSidebar.classList.add("visible");
        clearTimeout(hideTimeout);
        hideTimeout = setTimeout(hideControls, 3000);
    }
    function hideControls() {
        sidebar.classList.remove("visible");
        footer.classList.remove("visible");
        playlistSidebar.classList.remove("visible");
    }
    showControls();
    document.addEventListener("mousemove", showControls);
});