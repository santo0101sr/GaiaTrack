export const QUALITY_LEVELS = ['low', 'mid', 'high'];

export const QUALITY_PRESETS = {
  high: {
    id: 'high',
    maxPixelRatio: 1.5,
    antialias: true,
    shadows: true,
    toneMapping: true,
    maxRainDrops: 900,
    maxOverviewRain: 200,
    maxClouds: 10,
    mistEnabled: true,
    splashesEnabled: true,
    bevelEnabled: true
  },
  mid: {
    id: 'mid',
    maxPixelRatio: 1.0,
    antialias: true,
    shadows: false,
    toneMapping: false,
    maxRainDrops: 420,
    maxOverviewRain: 110,
    maxClouds: 6,
    mistEnabled: true,
    splashesEnabled: false,
    bevelEnabled: false
  },
  low: {
    id: 'low',
    maxPixelRatio: 0.9,
    antialias: false,
    shadows: false,
    toneMapping: false,
    maxRainDrops: 160,
    maxOverviewRain: 48,
    maxClouds: 3,
    mistEnabled: false,
    splashesEnabled: false,
    bevelEnabled: false
  }
};

export function detectHardwareTier({
  deviceMemory = typeof navigator !== 'undefined' ? navigator.deviceMemory : undefined,
  hardwareConcurrency = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined,
  prefersReducedMotion = typeof matchMedia === 'function'
    ? matchMedia('(prefers-reduced-motion: reduce)').matches
    : false
} = {}) {
  if (prefersReducedMotion) return 'low';
  if (Number.isFinite(deviceMemory) && deviceMemory <= 2) return 'low';
  if (Number.isFinite(hardwareConcurrency) && hardwareConcurrency <= 2) return 'low';
  if (Number.isFinite(deviceMemory) && deviceMemory <= 4) return 'mid';
  if (Number.isFinite(hardwareConcurrency) && hardwareConcurrency <= 4) return 'mid';
  return 'high';
}

export function createQualityManager({
  initialMode = 'auto',
  hardware = {},
  slowFrameMs = 33,
  windowSize = 24,
  minSlowCount = 16,
  cooldownFrames = 45,
  onChange = () => {}
} = {}) {
  let mode = ['auto', ...QUALITY_LEVELS].includes(initialMode) ? initialMode : 'auto';
  const detected = detectHardwareTier(hardware);
  let active = mode === 'auto' ? detected : mode;
  let governorForced = false;
  let recent = [];
  let cooldown = 0;

  function apply(nextActive, { reason = 'mode', notify = true } = {}) {
    if (nextActive === active && reason === 'governor') return false;
    active = nextActive;
    if (notify) {
      onChange({
        mode,
        active,
        preset: QUALITY_PRESETS[active],
        reason,
        governorForced
      });
    }
    return true;
  }

  return {
    get mode() { return mode; },
    get active() { return active; },
    get detected() { return detected; },
    get preset() { return QUALITY_PRESETS[active]; },
    get governorForced() { return governorForced; },
    setMode(nextMode) {
      if (!['auto', ...QUALITY_LEVELS].includes(nextMode)) return active;
      mode = nextMode;
      governorForced = false;
      recent = [];
      cooldown = 0;
      const target = mode === 'auto' ? detected : mode;
      apply(target, { reason: 'user' });
      return active;
    },
    recordFrameTime(ms) {
      if (!Number.isFinite(ms) || ms < 0) return null;
      if (cooldown > 0) {
        cooldown--;
        return null;
      }
      recent.push(ms);
      if (recent.length > windowSize) recent.shift();
      if (recent.length < windowSize) return null;
      const slowCount = recent.filter(v => v > slowFrameMs).length;
      if (slowCount < minSlowCount) return null;
      const idx = QUALITY_LEVELS.indexOf(active);
      if (idx <= 0) return null;
      const next = QUALITY_LEVELS[idx - 1];
      recent = [];
      cooldown = cooldownFrames;
      governorForced = true;
      apply(next, { reason: 'governor' });
      return next;
    },
    resetGovernor() {
      recent = [];
      cooldown = 0;
      governorForced = false;
    }
  };
}
