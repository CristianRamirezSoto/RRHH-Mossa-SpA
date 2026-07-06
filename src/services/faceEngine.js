import Human from '@vladmandic/human';

const human = new Human({
  backend: 'webgl',
  modelBasePath: '/models/',
  cacheModels: true,
  debug: false,
  face: {
    enabled: true,
    detector: {
      enabled: true,
      modelPath: 'blazeface.json',
      maxDetected: 1,
      minConfidence: 0.65,
      minSize: 100,
      rotation: true,
    },
    mesh: { enabled: true, modelPath: 'facemesh.json' },
    iris: { enabled: true, modelPath: 'iris.json' },
    description: { enabled: true, modelPath: 'faceres.json', minConfidence: 0.65 },
    antispoof: { enabled: true, modelPath: 'antispoof.json' },
    liveness: { enabled: true, modelPath: 'liveness.json' },
    emotion: { enabled: false },
    attention: { enabled: false },
    gear: { enabled: false },
  },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  gesture: { enabled: true },
});

let loadingPromise;

export async function loadFaceEngine() {
  if (!loadingPromise) {
    loadingPromise = (async () => {
      await human.load();
      await human.warmup();
      return human;
    })();
  }
  return loadingPromise;
}

export async function analyzeFace(input) {
  await loadFaceEngine();
  const result = await human.detect(input);
  const face = result.face?.[0];
  if (!face) return { detected: false, gestures: [] };

  return {
    detected: true,
    descriptor: face.embedding || null,
    score: face.score || 0,
    real: normalizeScore(face.real),
    live: normalizeScore(face.live),
    rotation: face.rotation?.angle || null,
    gestures: (result.gesture || [])
      .filter((item) => Object.prototype.hasOwnProperty.call(item, 'face'))
      .map((item) => item.gesture),
    box: face.boxRaw,
  };
}

function normalizeScore(value) {
  if (value === true) return 1;
  if (value === false) return 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function createBiometricTemplate(descriptors) {
  const validDescriptors = descriptors.filter((descriptor) => descriptor?.length);
  if (!validDescriptors.length) return null;
  const length = validDescriptors[0].length;
  const average = Array.from({ length }, (_, index) => (
    validDescriptors.reduce((sum, descriptor) => sum + Number(descriptor[index] || 0), 0) / validDescriptors.length
  ));
  const magnitude = Math.sqrt(average.reduce((sum, value) => sum + value * value, 0)) || 1;
  return average.map((value) => value / magnitude);
}

export function findBestFaceMatch(descriptor, profiles, threshold = 0.54) {
  const currentDescriptor = normalizeDescriptor(descriptor);
  if (!currentDescriptor?.length) return null;
  const matches = profiles
    .map((profile) => ({ ...profile, descriptor: normalizeDescriptor(profile.descriptor) }))
    .filter((profile) => profile.descriptor?.length === currentDescriptor.length)
    .map((profile) => ({
      ...profile,
      similarity: human.match.similarity(currentDescriptor, profile.descriptor),
    }))
    .sort((a, b) => b.similarity - a.similarity);

  const best = matches[0] || null;
  if (!best) return null;
  return { ...best, accepted: best.similarity >= threshold, threshold };
}

function normalizeDescriptor(descriptor) {
  if (!descriptor) return null;
  if (Array.isArray(descriptor)) return descriptor.map(Number);
  if (ArrayBuffer.isView(descriptor)) return Array.from(descriptor).map(Number);
  if (typeof descriptor === 'object') {
    const values = Object.values(descriptor);
    return values.length ? values.map(Number) : null;
  }
  return null;
}

export function createLivenessChallenge() {
  const challenges = [
    { id: 'turn-left', label: 'Gira suavemente tu rostro a la izquierda' },
    { id: 'turn-right', label: 'Gira suavemente tu rostro a la derecha' },
    { id: 'blink', label: 'Parpadea una vez' },
  ];
  return challenges[Math.floor(Math.random() * challenges.length)];
}

export function challengeCompleted(challenge, analysis) {
  const gestures = analysis.gestures || [];
  if (challenge.id === 'turn-left') {
    return gestures.includes('facing left') || Number(analysis.rotation?.yaw || 0) > 0.14;
  }
  if (challenge.id === 'turn-right') {
    return gestures.includes('facing right') || Number(analysis.rotation?.yaw || 0) < -0.14;
  }
  return gestures.some((gesture) => String(gesture).startsWith('blink '))
    || Math.abs(Number(analysis.rotation?.yaw || 0)) > 0.08
    || Math.abs(Number(analysis.rotation?.pitch || 0)) > 0.08;
}

export function biometricQuality(analysis, options = {}) {
  const { requireAntiSpoof = false } = options;
  if (!analysis.detected || !analysis.descriptor) return { valid: false, reason: 'Rostro no detectado' };
  if (analysis.score < 0.5) return { valid: false, reason: 'Acercate un poco mas a la camara' };

  if (requireAntiSpoof) {
    const real = analysis.real ?? 1;
    const live = analysis.live ?? 1;
    if (real < 0.32 && live < 0.32) {
      return { valid: false, reason: 'Necesitamos ver movimiento real, no una foto.' };
    }
  }

  return { valid: true };
}
