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
      minConfidence: 0.55,
      minSize: 60,
      rotation: true,
    },
    mesh: { enabled: true, modelPath: 'facemesh.json' },
    iris: { enabled: true, modelPath: 'iris.json' },
    description: { enabled: true, modelPath: 'faceres.json', minConfidence: 0.55 },
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
    size: readFaceSize(face),
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
  const validDescriptors = descriptors
    .map(normalizeDescriptor)
    .filter((descriptor) => descriptor?.length);
  if (!validDescriptors.length) return null;
  const length = validDescriptors[0].length;
  const sameLengthDescriptors = validDescriptors.filter((descriptor) => descriptor.length === length);
  const templates = sameLengthDescriptors.map((descriptor) => normalizeVector(descriptor));
  const average = Array.from({ length }, (_, index) => (
    templates.reduce((sum, descriptor) => sum + Number(descriptor[index] || 0), 0) / templates.length
  ));
  return {
    version: 2,
    createdAt: new Date().toISOString(),
    sampleCount: templates.length,
    centroid: normalizeVector(average),
    templates,
  };
}

export function findBestFaceMatch(descriptor, profiles, threshold = 0.52) {
  const currentDescriptor = normalizeDescriptor(descriptor);
  if (!currentDescriptor?.length) return null;
  const matches = profiles
    .map((profile) => {
      const descriptors = extractProfileDescriptors(profile.descriptor)
        .filter((item) => item?.length === currentDescriptor.length);
      const similarities = descriptors.map((item) => human.match.similarity(currentDescriptor, item));
      const bestSimilarity = Math.max(...similarities, 0);
      const averageTopSimilarity = average(similarities.sort((a, b) => b - a).slice(0, 3));
      return {
        ...profile,
        descriptors,
        similarity: Math.max(bestSimilarity, averageTopSimilarity),
        bestSimilarity,
      };
    })
    .filter((profile) => profile.descriptors.length)
    .sort((a, b) => b.similarity - a.similarity);

  const best = matches[0] || null;
  if (!best) return null;
  const second = matches[1] || null;
  const margin = second ? best.similarity - second.similarity : 1;
  const accepted = best.similarity >= threshold && (best.similarity >= 0.6 || margin >= 0.02);
  return { ...best, accepted, threshold, margin, secondSimilarity: second?.similarity || 0 };
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
  if (analysis.score < 0.32) return { valid: false, reason: 'Mira de frente y mejora la luz para capturar el rostro.' };

  if (requireAntiSpoof) {
    const real = analysis.real ?? 1;
    const live = analysis.live ?? 1;
    if (real < 0.25 && live < 0.25) {
      return { valid: false, reason: 'Necesitamos ver movimiento real, no una foto.' };
    }
  }

  return { valid: true };
}

function readFaceSize(face) {
  const box = face.box || face.boxRaw;
  if (!box) return null;
  if (Array.isArray(box)) {
    const width = Number(box[2] || 0);
    const height = Number(box[3] || 0);
    return { width, height };
  }
  return {
    width: Number(box.width || box.w || 0),
    height: Number(box.height || box.h || 0),
  };
}

function extractProfileDescriptors(descriptor) {
  if (!descriptor) return [];
  if (Array.isArray(descriptor) || ArrayBuffer.isView(descriptor)) return [normalizeDescriptor(descriptor)];
  if (descriptor.version >= 2) {
    return [
      normalizeDescriptor(descriptor.centroid),
      ...(Array.isArray(descriptor.templates) ? descriptor.templates.map(normalizeDescriptor) : []),
    ].filter(Boolean);
  }
  return [normalizeDescriptor(descriptor)];
}

function normalizeVector(values) {
  const numericValues = values.map(Number);
  const magnitude = Math.sqrt(numericValues.reduce((sum, value) => sum + value * value, 0)) || 1;
  return numericValues.map((value) => value / magnitude);
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}
