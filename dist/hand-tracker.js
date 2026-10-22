/**
 * Local MediaPipe hand tracking. This module never requests a camera and never
 * uploads frames. Call createHandTracker only after the user enables tracking.
 *
 * onResults receives raw, unmirrored normalized landmarks, then a timestamp.
 * Mirror x in the view if the camera preview is mirrored.
 */
export async function createHandTracker({ video, onResults = () => {}, onStatus = () => {} }) {
  if (!video || typeof video.play !== 'function') {
    throw new TypeError('El takibi için bir video öğesi gerekiyor.');
  }

  const status = (state, message, extra = {}) => onStatus({ state, message, ...extra });
  status('loading', 'El takibi hazırlanıyor…');

  let detector;
  let delegate = 'GPU';
  try {
    const { FilesetResolver, HandLandmarker } = await import('./vendor/vision_bundle.mjs');
    const fileset = await FilesetResolver.forVisionTasks(
      new URL('./vendor/wasm', import.meta.url).href,
    );
    const modelAssetPath = new URL('./models/hand_landmarker.task', import.meta.url).href;
    const options = {
      baseOptions: { modelAssetPath, delegate },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.6,
      minTrackingConfidence: 0.55,
    };

    try {
      detector = await HandLandmarker.createFromOptions(fileset, options);
    } catch (gpuError) {
      // A camera can work on devices whose WebGL acceleration is unavailable.
      delegate = 'CPU';
      status('loading', 'El takibi uyumlu modda hazırlanıyor…');
      detector = await HandLandmarker.createFromOptions(fileset, {
        ...options,
        baseOptions: { modelAssetPath, delegate },
      });
    }
  } catch (error) {
    status('error', 'El takibi yüklenemedi. Fare veya dokunmayla devam edebilirsin.');
    throw new Error('El takibi başlatılamadı.', { cause: error });
  }

  let active = false;
  let disposed = false;
  let animationId = null;
  let lastDetectionAt = -Infinity;
  let lastVideoTime = -1;
  let lastTimestamp = -1;
  let consecutiveErrors = 0;
  let lastHadHands = false;
  let frameInterval = 50;

  function clearHands(timestamp = performance.now()) {
    if (lastHadHands) {
      lastHadHands = false;
      onResults([], timestamp);
    }
  }

  function schedule() {
    if (active && !disposed && animationId === null) {
      animationId = requestAnimationFrame(tick);
    }
  }

  function tick(timestamp) {
    animationId = null;
    if (!active || disposed) return;

    if (document.hidden || video.paused || video.ended || video.readyState < 2 || !video.videoWidth) {
      clearHands(timestamp);
      schedule();
      return;
    }
    if (timestamp - lastDetectionAt < frameInterval || video.currentTime === lastVideoTime) {
      schedule();
      return;
    }

    lastDetectionAt = timestamp;
    lastVideoTime = video.currentTime;
    const monotonicTimestamp = Math.max(timestamp, lastTimestamp + 0.001);
    lastTimestamp = monotonicTimestamp;
    let landmarks;
    try {
      const startedAt = performance.now();
      const result = detector.detectForVideo(video, monotonicTimestamp);
      landmarks = result.landmarks || [];
      // Keep slower machines responsive while never exceeding 20 detections/s.
      const elapsed = performance.now() - startedAt;
      frameInterval = Math.max(50, Math.min(160, elapsed * 1.5));
      consecutiveErrors = 0;
    } catch (error) {
      consecutiveErrors += 1;
      clearHands(monotonicTimestamp);
      if (consecutiveErrors >= 5) {
        active = false;
        status('error', 'El takibi durdu. Yeniden açabilir veya fareyle oynayabilirsin.');
        return;
      }
      schedule();
      return;
    }

    lastHadHands = landmarks.length > 0;
    try {
      onResults(landmarks, monotonicTimestamp);
    } finally {
      schedule();
    }
  }

  function start() {
    if (disposed) throw new Error('Kapatılmış el takibi tekrar başlatılamaz.');
    if (active) return;
    active = true;
    consecutiveErrors = 0;
    lastVideoTime = -1;
    lastDetectionAt = -Infinity;
    status('running', 'El takibi açık', { delegate });
    schedule();
  }

  function stop() {
    if (disposed) return;
    active = false;
    if (animationId !== null) cancelAnimationFrame(animationId);
    animationId = null;
    clearHands();
    status('stopped', 'El takibi kapalı');
  }

  function dispose() {
    if (disposed) return;
    stop();
    disposed = true;
    detector.close();
    detector = null;
  }

  status('ready', 'El takibi hazır', { delegate });
  return { start, stop, dispose };
}
