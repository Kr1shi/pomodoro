document.addEventListener('DOMContentLoaded', () => {
    let timerInterval = null;
    let secondsRemaining = 0;
    let originalSeconds = 0;
    let isPaused = false;
    let timerStartDate = null;
    let timerStartTimestamp = null;
    let pausedElapsedSeconds = 0;

    const focusBtn = document.getElementById('focusBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const stopBtn = document.getElementById('stopBtn');
    const timerDisplay = document.getElementById('timer');
    const minutesInput = document.getElementById('minutesInput');
    const secondsInput = document.getElementById('secondsInput');
    const dailyTotalDisplay = document.getElementById('dailyTotalDisplay');
    const progressRing = document.getElementById('progressRing');
    const pauseIcon = document.getElementById('pauseIcon');
    const goalProgressFill = document.getElementById('goalProgressFill');

    // Progress ring setup
    const radius = 120;
    const circumference = 2 * Math.PI * radius;
    progressRing.style.strokeDasharray = `${circumference} ${circumference}`;
    progressRing.style.strokeDashoffset = circumference;

    // SVG paths for pause/play toggle
    const PAUSE_PATH = 'M6 19h4V5H6v14zm8-14v14h4V5h-4z';
    const PLAY_PATH = 'M8 5v14l11-7z';

    function setProgress(percent) {
        const offset = circumference - (percent / 100) * circumference;
        progressRing.style.strokeDashoffset = offset;
    }

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // Request notification permission from user
    function requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    // Send notification when timer completes
    function notifyTimerComplete(minutes, seconds) {
        // Browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Focus Complete! ✓', {
                body: `${minutes} min ${seconds} sec completed`,
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="green"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>'
            });
        }

        // Audio alert using Web Audio API
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800; // Frequency in Hz
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.6, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (e) {
            console.log('Audio notification skipped:', e);
        }
    }

    let dailyTotalCache = 0;

    function getTodayKey() {
        const today = new Date().toISOString().split('T')[0];
        return today;
    }

    function updateGoalProgress() {
        const GOAL_SECONDS = 10800; // 3 hours = 10,800 seconds
        const totalSeconds = getDailyTotal();
        const percentage = Math.min((totalSeconds / GOAL_SECONDS) * 100, 100);
        goalProgressFill.style.width = `${percentage}%`;

        // Update color: red (0%) -> yellow (50%) -> green (100%)
        if (percentage >= 100) {
            // Rainbow animation at 100%
            goalProgressFill.classList.add('rainbow');
        } else {
            goalProgressFill.classList.remove('rainbow');
            // HSL color: 0 (red) to 120 (green)
            const hue = Math.round(percentage * 1.2);
            goalProgressFill.style.backgroundColor = `hsl(${hue}, 100%, 50%)`;
        }
    }

    function updateDailyTotalDisplay() {
        const totalSeconds = getDailyTotal();
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        dailyTotalDisplay.textContent = `${minutes} min ${seconds} sec`;
        updateGoalProgress();
    }

    // Load timer preferences
    async function loadPreferences() {
        try {
            const response = await fetch('/api/preferences');
            const prefs = await response.json();
            minutesInput.value = prefs.lastMinutes;
            secondsInput.value = prefs.lastSeconds.toString().padStart(2, '0');
            updateInitialDisplay();
        } catch (err) {
            console.error('Failed to load preferences:', err);
        }
    }

    // Save timer preferences
    async function savePreferences(minutes, seconds) {
        try {
            await fetch('/api/preferences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lastMinutes: minutes, lastSeconds: seconds })
            });
        } catch (err) {
            console.error('Failed to save preferences:', err);
        }
    }

    async function loadDailyTotal() {
        try {
            const response = await fetch(`/api/daily-total/${getTodayKey()}`);
            const data = await response.json();
            dailyTotalCache = data.total;
            updateDailyTotalDisplay();
            return data.total;
        } catch (err) {
            console.error('Failed to load daily total:', err);
            updateDailyTotalDisplay();
            return dailyTotalCache;
        }
    }

    function getDailyTotal() {
        return dailyTotalCache;
    }

    async function addToDailyWithDate(seconds, date) {
        try {
            const response = await fetch(`/api/daily-total/${date}`);
            const data = await response.json();
            const newTotal = data.total + seconds;

            await fetch(`/api/daily-total/${date}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ total: newTotal })
            });

            // Update cache and display only if it's today's date
            if (date === getTodayKey()) {
                dailyTotalCache = newTotal;
                updateDailyTotalDisplay();
            }
        } catch (err) {
            console.error('Failed to save daily total:', err);
        }
    }

    async function addToDaily(seconds) {
        return addToDailyWithDate(seconds, getTodayKey());
    }

    function resetTimerDisplay() {
        pauseBtn.style.display = 'none';
        stopBtn.style.display = 'none';
        focusBtn.disabled = false;
        minutesInput.disabled = false;
        secondsInput.disabled = false;
        setProgress(0);
    }

    function resumeTimer() {
        isPaused = false;
        pauseIcon.querySelector('path').setAttribute('d', PAUSE_PATH);
        timerStartTimestamp = Date.now() - (pausedElapsedSeconds * 1000);
        timerInterval = setInterval(() => {
            const elapsedSeconds = Math.floor((Date.now() - timerStartTimestamp) / 1000);
            secondsRemaining = Math.max(0, originalSeconds - elapsedSeconds);
            timerDisplay.textContent = formatTime(secondsRemaining);

            const percent = (secondsRemaining / originalSeconds) * 100;
            setProgress(percent);

            if (secondsRemaining === 0) {
                clearInterval(timerInterval);
                // Use start date to handle cross-day sessions
                addToDailyWithDate(originalSeconds, timerStartDate);
                const sessMinutes = Math.floor(originalSeconds / 60);
                const sessSeconds = originalSeconds % 60;

                // Send notification
                notifyTimerComplete(sessMinutes, sessSeconds);

                timerDisplay.innerHTML = `
                    <div class="completion-message">
                        <div class="completion-message__icon">&#10003;</div>
                        <div class="completion-message__title">Focus Complete!</div>
                        <div class="completion-message__session">${sessMinutes} min ${sessSeconds} sec</div>
                    </div>
                `;

                resetTimerDisplay();
            }
        }, 1000);
    }

    function stopTimer() {
        clearInterval(timerInterval);
        const elapsedSeconds = isPaused ? pausedElapsedSeconds : Math.floor((Date.now() - timerStartTimestamp) / 1000);
        const elapsedMinutes = Math.floor(elapsedSeconds / 60);
        const elapsedSecs = elapsedSeconds % 60;

        // Use start date to handle cross-day sessions
        addToDailyWithDate(elapsedSeconds, timerStartDate);

        timerDisplay.innerHTML = `
            <div class="completion-message">
                <div class="completion-message__title">Session Ended</div>
                <div class="completion-message__session">${elapsedMinutes} min ${elapsedSecs} sec</div>
            </div>
        `;

        resetTimerDisplay();
    }

    function pauseTimer() {
        if (isPaused) {
            resumeTimer();
        } else {
            isPaused = true;
            clearInterval(timerInterval);
            pauseIcon.querySelector('path').setAttribute('d', PLAY_PATH);
            // Save elapsed time for when we resume
            pausedElapsedSeconds = originalSeconds - secondsRemaining;
        }
    }

    function startTimer() {
        const minutes = parseInt(minutesInput.value) || 0;
        const seconds = parseInt(secondsInput.value) || 0;
        const totalSeconds = minutes * 60 + seconds;

        if (totalSeconds < 1) {
            alert('Please enter a valid time (at least 1 second)');
            return;
        }

        // Save preferences for next time
        savePreferences(minutes, seconds);

        // Capture the start date for cross-day session attribution
        timerStartDate = getTodayKey();

        secondsRemaining = totalSeconds;
        originalSeconds = totalSeconds;
        pausedElapsedSeconds = 0;
        timerStartTimestamp = Date.now();
        timerDisplay.textContent = formatTime(secondsRemaining);
        pauseBtn.style.display = 'flex';
        stopBtn.style.display = 'flex';
        isPaused = false;
        setProgress(100);

        focusBtn.disabled = true;
        minutesInput.disabled = true;
        secondsInput.disabled = true;

        resumeTimer();
    }

    // Update timer display on input change
    function updateInitialDisplay() {
        const minutes = parseInt(minutesInput.value) || 0;
        const seconds = parseInt(secondsInput.value) || 0;
        timerDisplay.textContent = formatTime(minutes * 60 + seconds);
    }

    minutesInput.addEventListener('input', updateInitialDisplay);
    secondsInput.addEventListener('input', updateInitialDisplay);

    focusBtn.addEventListener('click', startTimer);
    pauseBtn.addEventListener('click', pauseTimer);
    stopBtn.addEventListener('click', stopTimer);

    // Initialize
    loadPreferences();
    loadDailyTotal();
    requestNotificationPermission();
});
