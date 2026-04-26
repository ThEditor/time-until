/* ============================================================
   TIME UNTIL — Application Logic
   ============================================================ */

(() => {
  'use strict';

  // ── Constants ──────────────────────────────────────────────
  const STORAGE_KEY = 'timeuntil_config';
  const THEMES = ['midnight', 'nord', 'aurora', 'sakura', 'light', 'custom'];
  const DEFAULT_CONFIG = {
    label: 'New Year 2027',
    targetDate: '2027-01-01',
    targetTime: '00:00',
    creationDate: new Date().toISOString().split('T')[0],
    theme: 'nord',
    showProgress: true,
    showSeconds: true,
    customColors: {
      bg: '#1e1e2e',
      accent: '#7c3aed',
      text: '#e0def4',
    },
  };

  // ── Fullscreen SVG Icons ───────────────────────────────────
  const FS_ENTER_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
  </svg>`;
  const FS_EXIT_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 14h6v6m10-10h-6V4m0 6 7-7M3 21l7-7"/>
  </svg>`;

  // ── DOM References ─────────────────────────────────────────
  const $ = (id) => document.getElementById(id);

  const dom = {
    body: document.documentElement,
    bgGradient: $('bgGradient'),
    label: $('label'),
    countdown: $('countdown'),
    days: $('days'),
    hours: $('hours'),
    minutes: $('minutes'),
    seconds: $('seconds'),
    unitSeconds: $('unitSeconds'),
    progressContainer: $('progressContainer'),
    progressBar: $('progressBar'),
    progressText: $('progressText'),
    completionState: $('completionState'),
    completionLabel: $('completionLabel'),
    mainContainer: $('mainContainer'),
    // Controls
    fullscreenBtn: $('fullscreenBtn'),
    shareBtn: $('shareBtn'),
    settingsBtn: $('settingsBtn'),
    // Settings
    settingsOverlay: $('settingsOverlay'),
    settingsBackdrop: $('settingsBackdrop'),
    settingsPanel: $('settingsPanel'),
    settingsClose: $('settingsClose'),
    labelInput: $('labelInput'),
    dateInput: $('dateInput'),
    timeInput: $('timeInput'),
    creationDateInput: $('creationDateInput'),
    themeGrid: $('themeGrid'),
    progressToggle: $('progressToggle'),
    secondsToggle: $('secondsToggle'),
    // Custom theme
    customThemeOptions: $('customThemeOptions'),
    customBg: $('customBg'),
    customAccent: $('customAccent'),
    customText: $('customText'),
    // Toast
    toast: $('toast'),
    // Confetti
    confettiCanvas: $('confettiCanvas'),
  };

  // ── State ──────────────────────────────────────────────────
  let config = { ...DEFAULT_CONFIG };
  let timerInterval = null;
  let isCompleted = false;
  let confettiAnimationId = null;
  let prevValues = { days: '', hours: '', minutes: '', seconds: '' };
  let toastTimeout = null;

  // ── Persistence ────────────────────────────────────────────
  function loadConfig() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        config = { ...DEFAULT_CONFIG, ...parsed };
        // Merge nested customColors
        config.customColors = { ...DEFAULT_CONFIG.customColors, ...(parsed.customColors || {}) };
      }
    } catch (e) {
      console.warn('Failed to load config:', e);
    }

    // Check URL params (for shared links)
    const params = new URLSearchParams(window.location.search);
    if (params.has('d')) {
      config.targetDate = params.get('d');
      if (params.has('t')) config.targetTime = params.get('t');
      if (params.has('l')) config.label = decodeURIComponent(params.get('l'));
      if (params.has('theme') && THEMES.includes(params.get('theme'))) {
        config.theme = params.get('theme');
      }
      // Clear URL params after reading
      window.history.replaceState({}, '', window.location.pathname);
    }
  }

  function saveConfig() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
      console.warn('Failed to save config:', e);
    }
  }

  // ── Color Utilities ────────────────────────────────────────
  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  }

  function getLuminance(hex) {
    const { r, g, b } = hexToRgb(hex);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  function adjustBrightness(hex, amount) {
    const { r, g, b } = hexToRgb(hex);
    const clamp = (v) => Math.max(0, Math.min(255, Math.round(v + amount)));
    return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`;
  }

  function hexToRgba(hex, alpha) {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // ── Theme ──────────────────────────────────────────────────
  function applyTheme(theme) {
    dom.body.setAttribute('data-theme', theme);
    config.theme = theme;

    // Clear any inline custom properties if switching away from custom
    if (theme !== 'custom') {
      clearCustomProperties();
    } else {
      applyCustomColors(config.customColors.bg, config.customColors.accent, config.customColors.text);
    }

    // Update meta theme-color
    const themeColors = {
      midnight: '#0a0a1a',
      nord: '#2e3440',
      aurora: '#0f0c29',
      sakura: '#1a1020',
      light: '#f8fafc',
      custom: config.customColors.bg,
    };
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', themeColors[theme] || themeColors.nord);

    // Update active swatch
    dom.themeGrid.querySelectorAll('.theme-swatch').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });

    // Show/hide custom pickers
    dom.customThemeOptions.classList.toggle('collapsed', theme !== 'custom');

    saveConfig();
  }

  function clearCustomProperties() {
    const props = [
      '--bg-primary', '--bg-secondary', '--bg-tertiary', '--bg-glass',
      '--text-primary', '--text-secondary', '--text-muted',
      '--accent', '--accent-glow', '--accent-secondary',
      '--border', '--border-active',
      '--gradient-a', '--gradient-b', '--gradient-c',
      '--input-bg', '--input-border',
      '--progress-bg', '--progress-fill',
      '--separator-color', '--toast-bg', '--scrollbar-thumb',
    ];
    props.forEach((p) => dom.body.style.removeProperty(p));
  }

  function applyCustomColors(bg, accent, text) {
    const isDark = getLuminance(bg) < 0.5;
    const root = dom.body.style;

    root.setProperty('--bg-primary', bg);
    root.setProperty('--bg-secondary', adjustBrightness(bg, isDark ? 12 : -8));
    root.setProperty('--bg-tertiary', adjustBrightness(bg, isDark ? 24 : -16));
    root.setProperty('--bg-glass', hexToRgba(bg, 0.78));

    root.setProperty('--text-primary', text);
    root.setProperty('--text-secondary', hexToRgba(text, 0.55));
    root.setProperty('--text-muted', hexToRgba(text, 0.3));

    root.setProperty('--accent', accent);
    root.setProperty('--accent-glow', hexToRgba(accent, 0.25));
    root.setProperty('--accent-secondary', adjustBrightness(accent, isDark ? 40 : -40));

    const borderBase = isDark ? '255, 255, 255' : '0, 0, 0';
    root.setProperty('--border', `rgba(${borderBase}, 0.06)`);
    root.setProperty('--border-active', hexToRgba(accent, 0.4));

    root.setProperty('--gradient-a', accent);
    root.setProperty('--gradient-b', adjustBrightness(accent, 30));
    root.setProperty('--gradient-c', adjustBrightness(accent, -30));

    root.setProperty('--input-bg', `rgba(${borderBase}, ${isDark ? 0.04 : 0.03})`);
    root.setProperty('--input-border', `rgba(${borderBase}, 0.1)`);

    root.setProperty('--progress-bg', `rgba(${borderBase}, 0.06)`);
    root.setProperty('--progress-fill', `linear-gradient(90deg, ${accent}, ${adjustBrightness(accent, 40)})`);
    root.setProperty('--separator-color', hexToRgba(text, 0.15));
    root.setProperty('--toast-bg', hexToRgba(bg, 0.92));
    root.setProperty('--scrollbar-thumb', hexToRgba(accent, 0.3));

    // Update the custom swatch preview colors
    const swatchEl = dom.themeGrid.querySelector('[data-theme="custom"]');
    if (swatchEl) {
      swatchEl.style.setProperty('--custom-swatch-bg', adjustBrightness(bg, isDark ? 10 : -5));
      swatchEl.style.setProperty('--custom-swatch-text', hexToRgba(text, 0.65));
      swatchEl.querySelector('.custom-swatch-c1').style.background = bg;
      swatchEl.querySelector('.custom-swatch-c2').style.background = accent;
      swatchEl.querySelector('.custom-swatch-c3').style.background = text;
    }

    // Update meta theme-color
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', bg);
  }

  // ── Countdown Logic ────────────────────────────────────────
  function getTargetTimestamp() {
    const dateStr = `${config.targetDate}T${config.targetTime || '00:00'}`;
    return new Date(dateStr).getTime();
  }

  function padNum(n, len = 2) {
    return String(n).padStart(len, '0');
  }

  function updateCountdown() {
    const now = Date.now();
    const target = getTargetTimestamp();
    const diff = target - now;

    if (diff <= 0) {
      handleCompletion();
      return;
    }

    if (isCompleted) {
      hideCompletion();
    }

    const totalSeconds = Math.floor(diff / 1000);
    const d = Math.floor(totalSeconds / 86400);
    const h = Math.floor((totalSeconds % 86400) / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    const newValues = {
      days: padNum(d, d >= 100 ? 3 : d >= 10 ? 2 : 3),
      hours: padNum(h),
      minutes: padNum(m),
      seconds: padNum(s),
    };

    // Update with tick animation
    updateDigit('days', dom.days, newValues.days);
    updateDigit('hours', dom.hours, newValues.hours);
    updateDigit('minutes', dom.minutes, newValues.minutes);
    updateDigit('seconds', dom.seconds, newValues.seconds);

    prevValues = newValues;

    // Update progress
    updateProgress(now, target);

    // Update document title
    updateTitle(d, h, m);
  }

  function updateDigit(key, el, value) {
    if (prevValues[key] !== value) {
      el.textContent = value;
      el.classList.remove('tick');
      // Force reflow for animation restart
      void el.offsetWidth;
      el.classList.add('tick');
    }
  }

  function updateProgress(now, target) {
    if (!config.showProgress) return;

    const creationDate = new Date(config.creationDate).getTime();
    const totalDuration = target - creationDate;

    if (totalDuration <= 0) {
      dom.progressBar.style.setProperty('--progress', '0%');
      dom.progressText.textContent = '0% elapsed';
      return;
    }

    const elapsed = now - creationDate;
    const pct = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

    dom.progressBar.style.setProperty('--progress', `${pct.toFixed(2)}%`);
    dom.progressText.textContent = `${pct.toFixed(1)}% elapsed`;
  }

  function updateTitle(d, h, m) {
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0 || d > 0) parts.push(`${h}h`);
    parts.push(`${m}m`);
    document.title = `${parts.join(' ')} — ${config.label}`;
  }

  // ── Completion ─────────────────────────────────────────────
  function handleCompletion() {
    if (isCompleted) return;
    isCompleted = true;

    dom.days.textContent = '000';
    dom.hours.textContent = '00';
    dom.minutes.textContent = '00';
    dom.seconds.textContent = '00';

    dom.countdown.classList.add('hidden');
    dom.progressContainer.classList.add('hidden');
    dom.completionState.classList.remove('hidden');
    dom.completionLabel.textContent = `"${config.label}" has arrived!`;

    document.title = `🎉 ${config.label} — Time's Up!`;

    // Progress → 100%
    dom.progressBar.style.setProperty('--progress', '100%');
    dom.progressText.textContent = '100% elapsed';

    // Fire confetti
    startConfetti();
  }

  function hideCompletion() {
    isCompleted = false;
    dom.countdown.classList.remove('hidden');

    if (config.showProgress) {
      dom.progressContainer.classList.remove('hidden');
    }

    dom.completionState.classList.add('hidden');

    stopConfetti();
  }

  // ── Confetti ───────────────────────────────────────────────
  function startConfetti() {
    const canvas = dom.confettiCanvas;
    canvas.classList.remove('hidden');
    const ctx = canvas.getContext('2d');

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const particles = [];
    const colors = ['#6366f1', '#a855f7', '#ec4899', '#f59e0b', '#22c55e', '#06b6d4', '#f472b6'];

    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        w: Math.random() * 8 + 4,
        h: Math.random() * 6 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        vy: Math.random() * 3 + 1.5,
        vx: (Math.random() - 0.5) * 2,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 8,
        opacity: 1,
      });
    }

    let frame = 0;

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frame++;

      let alive = 0;
      for (const p of particles) {
        p.y += p.vy;
        p.x += p.vx;
        p.rotation += p.rotationSpeed;
        p.vy += 0.02; // gravity

        if (frame > 200) {
          p.opacity -= 0.008;
        }

        if (p.opacity <= 0 || p.y > canvas.height + 20) continue;
        alive++;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      if (alive > 0) {
        confettiAnimationId = requestAnimationFrame(animate);
      } else {
        canvas.classList.add('hidden');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    confettiAnimationId = requestAnimationFrame(animate);
  }

  function stopConfetti() {
    if (confettiAnimationId) {
      cancelAnimationFrame(confettiAnimationId);
      confettiAnimationId = null;
    }
    dom.confettiCanvas.classList.add('hidden');
  }

  // ── Settings Panel ─────────────────────────────────────────
  function openSettings() {
    // Populate inputs with current config
    dom.labelInput.value = config.label;
    dom.dateInput.value = config.targetDate;
    dom.timeInput.value = config.targetTime;
    dom.creationDateInput.value = config.creationDate;
    dom.progressToggle.checked = config.showProgress;
    dom.secondsToggle.checked = config.showSeconds;

    // Custom color pickers
    dom.customBg.value = config.customColors.bg;
    dom.customAccent.value = config.customColors.accent;
    dom.customText.value = config.customColors.text;

    // Show active theme
    dom.themeGrid.querySelectorAll('.theme-swatch').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.theme === config.theme);
    });

    // Show/hide custom pickers
    dom.customThemeOptions.classList.toggle('collapsed', config.theme !== 'custom');

    dom.settingsOverlay.classList.remove('hidden');

    // Focus first input after animation
    setTimeout(() => dom.labelInput.focus(), 400);
  }

  function closeSettings() {
    dom.settingsOverlay.classList.add('hidden');
  }

  function applySettings() {
    const newLabel = dom.labelInput.value.trim();
    const newDate = dom.dateInput.value;
    const newTime = dom.timeInput.value;
    const newCreationDate = dom.creationDateInput.value;
    const showProgress = dom.progressToggle.checked;
    const showSeconds = dom.secondsToggle.checked;

    if (newLabel) {
      config.label = newLabel;
      dom.label.textContent = newLabel;
    }
    if (newDate) config.targetDate = newDate;
    if (newTime) config.targetTime = newTime;
    if (newCreationDate) config.creationDate = newCreationDate;

    config.showProgress = showProgress;
    config.showSeconds = showSeconds;

    // Toggle progress visibility
    dom.progressContainer.classList.toggle('hidden', !showProgress);

    // Toggle seconds visibility
    dom.unitSeconds.classList.toggle('hidden-unit', !showSeconds);

    // If target changed, reset completion state
    hideCompletion();
    prevValues = { days: '', hours: '', minutes: '', seconds: '' };
    updateCountdown();

    saveConfig();
  }

  // ── Share ──────────────────────────────────────────────────
  function shareCountdown() {
    const params = new URLSearchParams();
    params.set('d', config.targetDate);
    params.set('t', config.targetTime);
    params.set('l', config.label);
    params.set('theme', config.theme);

    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;

    navigator.clipboard.writeText(url).then(() => {
      showToast('Link copied to clipboard!');
    }).catch(() => {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showToast('Link copied to clipboard!');
    });
  }

  // ── Toast ──────────────────────────────────────────────────
  function showToast(message) {
    dom.toast.textContent = message;
    dom.toast.classList.remove('hidden');

    // Force reflow
    void dom.toast.offsetWidth;
    dom.toast.classList.add('show');

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      dom.toast.classList.remove('show');
      setTimeout(() => dom.toast.classList.add('hidden'), 300);
    }, 2500);
  }

  // ── Fullscreen ─────────────────────────────────────────────
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  function updateFullscreenIcon() {
    const isFs = !!document.fullscreenElement;
    dom.fullscreenBtn.innerHTML = isFs ? FS_EXIT_SVG : FS_ENTER_SVG;
    dom.fullscreenBtn.title = isFs ? 'Exit fullscreen (F)' : 'Fullscreen (F)';
    dom.fullscreenBtn.setAttribute('aria-label', isFs ? 'Exit fullscreen' : 'Enter fullscreen');
  }

  // ── Event Bindings ─────────────────────────────────────────
  function bindEvents() {
    // Settings open/close
    dom.settingsBtn.addEventListener('click', openSettings);
    dom.settingsClose.addEventListener('click', closeSettings);
    dom.settingsBackdrop.addEventListener('click', closeSettings);

    // Real-time settings updates
    dom.labelInput.addEventListener('input', applySettings);
    dom.dateInput.addEventListener('change', applySettings);
    dom.timeInput.addEventListener('change', applySettings);
    dom.creationDateInput.addEventListener('change', applySettings);
    dom.progressToggle.addEventListener('change', applySettings);
    dom.secondsToggle.addEventListener('change', applySettings);

    // Theme swatches
    dom.themeGrid.addEventListener('click', (e) => {
      const swatch = e.target.closest('.theme-swatch');
      if (swatch && swatch.dataset.theme) {
        applyTheme(swatch.dataset.theme);
      }
    });

    // Custom color pickers
    const handleCustomColorChange = () => {
      config.customColors.bg = dom.customBg.value;
      config.customColors.accent = dom.customAccent.value;
      config.customColors.text = dom.customText.value;
      if (config.theme === 'custom') {
        applyCustomColors(config.customColors.bg, config.customColors.accent, config.customColors.text);
      }
      saveConfig();
    };
    dom.customBg.addEventListener('input', handleCustomColorChange);
    dom.customAccent.addEventListener('input', handleCustomColorChange);
    dom.customText.addEventListener('input', handleCustomColorChange);

    // Top controls
    dom.fullscreenBtn.addEventListener('click', toggleFullscreen);
    dom.shareBtn.addEventListener('click', shareCountdown);

    // Fullscreen change — swap icon
    document.addEventListener('fullscreenchange', updateFullscreenIcon);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') {
          closeSettings();
          e.target.blur();
        }
        return;
      }

      switch (e.key) {
        case 'Escape':
          closeSettings();
          break;
        case ',':
          e.preventDefault();
          if (dom.settingsOverlay.classList.contains('hidden')) {
            openSettings();
          } else {
            closeSettings();
          }
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 's':
        case 'S':
          e.preventDefault();
          shareCountdown();
          break;
      }
    });

    // Prevent body scroll on mobile when settings is open
    dom.settingsPanel.addEventListener('touchmove', (e) => {
      e.stopPropagation();
    }, { passive: true });
  }

  // ── Initialize ─────────────────────────────────────────────
  function init() {
    loadConfig();

    // Apply saved config to DOM
    dom.label.textContent = config.label;
    applyTheme(config.theme);

    // Update custom swatch preview on load
    if (config.customColors) {
      const swatchEl = dom.themeGrid.querySelector('[data-theme="custom"]');
      if (swatchEl) {
        const isDark = getLuminance(config.customColors.bg) < 0.5;
        swatchEl.style.setProperty('--custom-swatch-bg', adjustBrightness(config.customColors.bg, isDark ? 10 : -5));
        swatchEl.style.setProperty('--custom-swatch-text', hexToRgba(config.customColors.text, 0.65));
        swatchEl.querySelector('.custom-swatch-c1').style.background = config.customColors.bg;
        swatchEl.querySelector('.custom-swatch-c2').style.background = config.customColors.accent;
        swatchEl.querySelector('.custom-swatch-c3').style.background = config.customColors.text;
      }
    }

    // Seconds toggle
    if (!config.showSeconds) {
      dom.unitSeconds.classList.add('hidden-unit');
    }

    // Progress toggle
    if (!config.showProgress) {
      dom.progressContainer.classList.add('hidden');
    }

    bindEvents();

    // Start countdown
    updateCountdown();
    timerInterval = setInterval(updateCountdown, 1000);
  }

  // ── Boot ───────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
