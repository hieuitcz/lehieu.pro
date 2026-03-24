const state = {
  animals: [],
  currentIndex: 0,
  currentMode: 'sound',
  babyMode: true,
  autoplay: false,
  autoplayDelayMs: 2800,
  autoplayTimer: null,
  showEN: true,
  showCZ: true,
};

const els = {
  homeView: document.getElementById('homeView'),
  detailView: document.getElementById('detailView'),
  animalGrid: document.getElementById('animalGrid'),
  statusBar: document.getElementById('statusBar'),
  heroImage: document.getElementById('heroImage'),
  heroTitle: document.getElementById('heroTitle'),
  audioEl: document.getElementById('audioEl'),
  heroBtn: document.getElementById('heroBtn'),
  soundBtn: document.getElementById('soundBtn'),
  backBtn: document.getElementById('backBtn'),
  prevBtn: document.getElementById('prevBtn'),
  nextBtn: document.getElementById('nextBtn'),
  modeBtns: [...document.querySelectorAll('.mode-btn[data-mode]')],
  btnBaby: document.getElementById('btnBaby'),
  btnAutoplay: document.getElementById('btnAutoplay'),
  btnRandom: document.getElementById('btnRandom'),
  btnSettings: document.getElementById('btnSettings'),
  settingsModal: document.getElementById('settingsModal'),
  settingsBackdrop: document.getElementById('settingsBackdrop'),
  settingsClose: document.getElementById('settingsClose'),
  setShowEN: document.getElementById('setShowEN'),
  setShowCZ: document.getElementById('setShowCZ'),
  setAutoplay: document.getElementById('setAutoplay'),
  setSpeed: document.getElementById('setSpeed'),
  speedLabel: document.getElementById('speedLabel'),
};

function getName(animal) {
  if (state.currentMode === 'sound') return animal.name_vi || animal.name_en;
  if (state.currentMode === 'vi') return animal.name_vi || animal.name_en;
  if (state.currentMode === 'en') return animal.name_en || animal.name_vi;
  if (state.currentMode === 'cz') return animal.name_cz || animal.name_en || animal.name_vi;
  return animal.name_vi || animal.name_en;
}

function getSound(animal) {
  if (state.currentMode === 'sound') {
    return animal.sound || animal.sound_vi || animal.sound_en || animal.sound_cz || '';
  }
  return animal[`sound_${state.currentMode}`] || animal.sound || animal.sound_vi || animal.sound_en || animal.sound_cz || '';
}

function getSoundCandidates(animal) {
  const list = [];
  if (state.currentMode === 'sound') {
    list.push(animal.sound, animal.sound_vi, animal.sound_en, animal.sound_cz);
  } else {
    list.push(animal[`sound_${state.currentMode}`], animal.sound, animal.sound_vi, animal.sound_en, animal.sound_cz);
  }
  return [...new Set(list.filter(Boolean))];
}

function asset(path) {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  return `/${path.replace(/^\/+/, '')}`;
}

const preloadCache = {
  images: new Set(),
  audios: new Set(),
};

function preloadImage(url) {
  if (!url || preloadCache.images.has(url)) return;
  const img = new Image();
  img.src = url;
  preloadCache.images.add(url);
}

function preloadAudio(url) {
  if (!url || preloadCache.audios.has(url)) return;
  const audio = new Audio();
  audio.preload = 'metadata';
  audio.src = url;
  preloadCache.audios.add(url);
}

function preloadAround(index) {
  if (!state.animals.length) return;
  const total = state.animals.length;
  const targets = [index, (index + 1) % total, (index - 1 + total) % total];
  targets.forEach((i) => {
    const animal = state.animals[i];
    preloadImage(asset(animal?.image));
    preloadAudio(asset(getSound(animal || {})));
  });
}

async function loadAnimals() {
  try {
    els.statusBar.textContent = 'Đang tải dữ liệu…';
    const res = await fetch('/animals.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Không tải được animals.json');
    state.animals = await res.json();
    els.statusBar.textContent = `Đã tải ${state.animals.length} con vật`;
    renderGrid();
    preloadAround(0);
  } catch (err) {
    console.error(err);
    els.statusBar.textContent = 'Không tải được dữ liệu con vật 😢';
  }
}

function renderGrid() {
  els.animalGrid.innerHTML = '';
  state.animals.forEach((animal, index) => {
    const btn = document.createElement('button');
    btn.className = 'animal-card';
    btn.innerHTML = `
      <img src="${asset(animal.image)}" alt="${getName(animal)}" loading="lazy">
      <div class="animal-card__title">${getName(animal)}</div>
    `;
    btn.addEventListener('click', () => openDetail(index, true));
    els.animalGrid.appendChild(btn);
  });
}

function renderDetail() {
  const animal = state.animals[state.currentIndex];
  if (!animal) return;
  els.heroImage.src = asset(animal.image);
  els.heroImage.alt = getName(animal);
  els.heroTitle.textContent = getName(animal);
  preloadAround(state.currentIndex);
}

function playCurrentSound() {
  const animal = state.animals[state.currentIndex];
  if (!animal) return;

  const candidates = getSoundCandidates(animal).map(asset);
  if (!candidates.length) return;

  const audio = els.audioEl;
  audio.pause();
  audio.currentTime = 0;

  let idx = 0;
  const tryPlay = () => {
    if (idx >= candidates.length) {
      console.warn('Không phát được audio cho', animal.id, candidates);
      audio.onerror = null;
      return;
    }

    const url = candidates[idx++];
    audio.onerror = () => {
      console.warn('Audio lỗi, thử file khác:', url);
      tryPlay();
    };
    audio.src = url;
    audio.load();
    audio.play().catch(() => {
      tryPlay();
    });
  };

  tryPlay();
}

function openDetail(index, autoPlay = false) {
  state.currentIndex = index;
  renderDetail();

  // Căn lại viewport cho đẹp khi vào mode chi tiết
  window.scrollTo({ top: 0, behavior: 'smooth' });

  document.body.classList.add('detail-open');
  els.homeView.classList.remove('view--active');
  els.detailView.classList.add('view--active');
  if (autoPlay) playCurrentSound();
}

function goHome() {
  document.body.classList.remove('detail-open');
  els.detailView.classList.remove('view--active');
  els.homeView.classList.add('view--active');
  if (state.autoplay) {
    stopAutoplay();
    startAutoplay();
  }
}

function step(delta) {
  const total = state.animals.length;
  if (!total) return;
  state.currentIndex = (state.currentIndex + delta + total) % total;
  renderDetail();
  playCurrentSound();
}

function setMode(mode) {
  if (state.babyMode && (mode === 'en' || mode === 'cz')) {
    mode = 'vi';
  }
  state.currentMode = mode;
  els.modeBtns.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.mode === mode));
  renderGrid();
  if (els.detailView.classList.contains('view--active')) {
    renderDetail();
    preloadAround(state.currentIndex);
  }
}

function applyLanguageVisibility() {
  document.body.classList.toggle('hide-en', !state.showEN);
  document.body.classList.toggle('hide-cz', !state.showCZ);

  if (!state.showEN && state.currentMode === 'en') setMode('vi');
  if (!state.showCZ && state.currentMode === 'cz') setMode('vi');
}

function applyBabyModeUI() {
  document.body.classList.toggle('baby-mode', state.babyMode);
  if (els.btnBaby) {
    els.btnBaby.classList.toggle('is-active', state.babyMode);
    els.btnBaby.textContent = state.babyMode ? '🧸 Baby ON' : '🧸 Baby OFF';
  }
}

function applySettingsUI() {
  if (els.setShowEN) els.setShowEN.checked = state.showEN;
  if (els.setShowCZ) els.setShowCZ.checked = state.showCZ;
  if (els.setAutoplay) els.setAutoplay.checked = state.autoplay;
  if (els.setSpeed) els.setSpeed.value = String(state.autoplayDelayMs);
  if (els.speedLabel) els.speedLabel.textContent = `${(state.autoplayDelayMs / 1000).toFixed(1)}s`;
}

function openSettings() {
  applySettingsUI();
  els.settingsModal?.classList.add('is-open');
  els.settingsModal?.setAttribute('aria-hidden', 'false');
}

function closeSettings() {
  els.settingsModal?.classList.remove('is-open');
  els.settingsModal?.setAttribute('aria-hidden', 'true');
}

function stopAutoplay() {
  if (state.autoplayTimer) {
    clearInterval(state.autoplayTimer);
    state.autoplayTimer = null;
  }
}

function startAutoplay() {
  stopAutoplay();
  state.autoplayTimer = setInterval(() => {
    if (!els.detailView.classList.contains('view--active')) return;
    step(1);
  }, state.autoplayDelayMs);
}

function applyAutoplayUI() {
  if (!els.btnAutoplay) return;
  els.btnAutoplay.classList.toggle('is-active', state.autoplay);
  els.btnAutoplay.textContent = state.autoplay ? '⏸ Auto' : '▶ Auto';
}

function toggleAutoplay(forceValue = null) {
  state.autoplay = forceValue == null ? !state.autoplay : !!forceValue;
  if (state.autoplay) startAutoplay();
  else stopAutoplay();
  applyAutoplayUI();
  applySettingsUI();
}

function randomAnimal() {
  if (!state.animals.length) return;
  const next = Math.floor(Math.random() * state.animals.length);
  if (!els.detailView.classList.contains('view--active')) {
    openDetail(next, true);
    return;
  }
  state.currentIndex = next;
  renderDetail();
  playCurrentSound();
}

function toggleBabyMode() {
  state.babyMode = !state.babyMode;
  if (state.babyMode && (state.currentMode === 'en' || state.currentMode === 'cz')) {
    setMode('vi');
  }
  applyBabyModeUI();
}

let startX = null;
els.detailView.addEventListener('touchstart', (e) => {
  startX = e.touches[0].clientX;
}, { passive: true });

els.detailView.addEventListener('touchend', (e) => {
  if (startX == null) return;
  const dx = e.changedTouches[0].clientX - startX;
  if (Math.abs(dx) > 50) {
    if (dx < 0) step(1); else step(-1);
  }
  startX = null;
}, { passive: true });

els.heroBtn.addEventListener('click', playCurrentSound);
els.soundBtn.addEventListener('click', playCurrentSound);
els.backBtn.addEventListener('click', goHome);
els.prevBtn.addEventListener('click', () => step(-1));
els.nextBtn.addEventListener('click', () => step(1));
els.modeBtns.forEach((btn) => btn.addEventListener('click', () => setMode(btn.dataset.mode)));
if (els.btnBaby) els.btnBaby.addEventListener('click', toggleBabyMode);
if (els.btnAutoplay) els.btnAutoplay.addEventListener('click', () => toggleAutoplay());
if (els.btnRandom) els.btnRandom.addEventListener('click', randomAnimal);
if (els.btnSettings) els.btnSettings.addEventListener('click', openSettings);
if (els.settingsBackdrop) els.settingsBackdrop.addEventListener('click', closeSettings);
if (els.settingsClose) els.settingsClose.addEventListener('click', closeSettings);

if (els.setShowEN) {
  els.setShowEN.addEventListener('change', (e) => {
    state.showEN = e.target.checked;
    applyLanguageVisibility();
    renderGrid();
    if (els.detailView.classList.contains('view--active')) renderDetail();
  });
}

if (els.setShowCZ) {
  els.setShowCZ.addEventListener('change', (e) => {
    state.showCZ = e.target.checked;
    applyLanguageVisibility();
    renderGrid();
    if (els.detailView.classList.contains('view--active')) renderDetail();
  });
}

if (els.setAutoplay) {
  els.setAutoplay.addEventListener('change', (e) => {
    toggleAutoplay(e.target.checked);
  });
}

if (els.setSpeed) {
  els.setSpeed.addEventListener('input', (e) => {
    state.autoplayDelayMs = Number(e.target.value) || 2800;
    if (els.speedLabel) els.speedLabel.textContent = `${(state.autoplayDelayMs / 1000).toFixed(1)}s`;
    if (state.autoplay) startAutoplay();
  });
}

applyBabyModeUI();
applyLanguageVisibility();
applyAutoplayUI();
applySettingsUI();
loadAnimals();
