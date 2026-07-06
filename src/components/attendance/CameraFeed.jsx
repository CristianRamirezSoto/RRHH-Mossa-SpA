import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Icon } from '../AppLayout';

export const CameraFeed = forwardRef(function CameraFeed(
  { status, onReady, onCameraError, mirrored = true },
  forwardedRef
) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const onReadyRef = useRef(onReady);
  const onCameraErrorRef = useRef(onCameraError);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    onCameraErrorRef.current = onCameraError;
  }, [onCameraError]);

  useImperativeHandle(forwardedRef, () => ({
    getVideoElement() {
      return videoRef.current;
    },
    captureFrame() {
      const video = videoRef.current;
      if (!video?.videoWidth || !video?.videoHeight) return null;
      const canvas = document.createElement('canvas');
      const maxWidth = 720;
      const scale = Math.min(1, maxWidth / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.78);
    },
  }));

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Tu navegador no permite acceder a la cámara desde esta conexión.');
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setReady(true);
        onReadyRef.current?.();
      } catch (error) {
        onCameraErrorRef.current?.(error);
      }
    }

    startCamera();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  const activeDetection = ['detected', 'verifying', 'confirmed', 'registered'].includes(status);

  return (
    <div className={`camera-feed camera-${status}${mirrored ? ' camera-mirrored' : ''}`}>
      <video ref={videoRef} muted playsInline aria-label="Cámara para reconocimiento facial" />
      <div className="camera-shade" />
      <div className={`face-guide${activeDetection ? ' active' : ''}`}>
        <span className="guide-corner guide-top-left" />
        <span className="guide-corner guide-top-right" />
        <span className="guide-corner guide-bottom-left" />
        <span className="guide-corner guide-bottom-right" />
      </div>
      {!ready && (
        <div className="camera-loading">
          <Icon name="camera" size={28} />
          <span>Iniciando cámara…</span>
        </div>
      )}
      <div className="camera-privacy">
        <Icon name="shield" size={14} />
        La imagen se procesa temporalmente y no se almacena
      </div>
    </div>
  );
});
