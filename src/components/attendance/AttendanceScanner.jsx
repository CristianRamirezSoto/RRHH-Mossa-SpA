import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraFeed } from './CameraFeed';
import { RecognitionStatus } from './RecognitionStatus';
import {
  analyzeFace,
  biometricQuality,
  findBestFaceMatch,
  loadFaceEngine,
} from '../../services/faceEngine';
import { listBiometricProfiles, registerAttendance } from '../../services/attendanceApi';

export function AttendanceScanner({ markType = 'entry', onRegistered, terminalEnabled = true }) {
  const cameraRef = useRef(null);
  const runningRef = useRef(false);
  const pausedRef = useRef(false);
  const profilesRef = useRef([]);
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const actionLabel = markType === 'exit' ? 'salida' : 'entrada';
  const [detail, setDetail] = useState('Cargando motor biometrico local...');

  const resetScanner = useCallback((delay = 3500) => {
    window.setTimeout(() => {
      pausedRef.current = false;
      setResult(null);
      setDetail(`Ubicate frente a la camara para registrar tu ${actionLabel}.`);
      setStatus('idle');
    }, delay);
  }, [actionLabel]);

  useEffect(() => {
    let cancelled = false;

    async function refreshProfiles() {
      profilesRef.current = await listBiometricProfiles();
      if (cancelled) return;
      setDetail(
        profilesRef.current.length
          ? `Listo: ${profilesRef.current.length} rostro${profilesRef.current.length === 1 ? '' : 's'} enrolado${profilesRef.current.length === 1 ? '' : 's'}. Ubicate frente a la camara.`
          : 'No existen trabajadores enrolados. Primero enrola un rostro en Biometria.'
      );
    }

    async function initialize() {
      try {
        await loadFaceEngine();
        await refreshProfiles();
      } catch (error) {
        if (!cancelled) {
          setStatus('error');
          setDetail(`No fue posible cargar el marcaje facial: ${error.message}`);
        }
      }
    }

    initialize();
    const refreshTimer = window.setInterval(() => {
      refreshProfiles().catch(() => {});
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
    };
  }, []);

  const processCamera = useCallback(async () => {
    if (!terminalEnabled || runningRef.current || pausedRef.current) return;
    const video = cameraRef.current?.getVideoElement();
    if (!video || video.readyState < 2) return;

    if (!profilesRef.current.length) {
      setStatus('idle');
      setDetail('No hay rostros enrolados para comparar. Ve a Biometria y enrola al trabajador.');
      return;
    }

    runningRef.current = true;
    try {
      const analysis = await analyzeFace(video);
      if (!analysis.detected) {
        setStatus('idle');
        setDetail(`Ubicate frente a la camara para registrar tu ${actionLabel}.`);
        return;
      }

      setStatus('detected');
      setDetail('Rostro detectado. Verificando calidad...');
      const quality = biometricQuality(analysis, { requireAntiSpoof: false });
      if (!quality.valid) {
        setDetail(quality.reason);
        return;
      }

      setStatus('verifying');
      setDetail('Comparando tu rostro de forma local y segura...');
      const match = findBestFaceMatch(analysis.descriptor, profilesRef.current);
      if (!match?.accepted) {
        const percent = match ? Math.round(match.similarity * 100) : 0;
        throw new Error(`Rostro no reconocido (${percent}%). Reenrola el rostro con buena luz.`);
      }

      setStatus('confirmed');
      setResult({ employeeName: match.employeeName });
      setDetail(`Coincidencia biometrica: ${Math.round(match.similarity * 100)}%`);

      const mark = await registerAttendance(match.employeeId, match.similarity, markType);
      const completedResult = {
        ...mark,
        employeeName: match.employeeName,
      };
      setResult(completedResult);
      setStatus('registered');
      pausedRef.current = true;
      onRegistered?.(completedResult);
      resetScanner(4300);
    } catch (error) {
      setResult(null);
      setStatus('error');
      setDetail(normalizeRecognitionError(error));
      pausedRef.current = true;
      resetScanner(4200);
    } finally {
      runningRef.current = false;
    }
  }, [actionLabel, markType, onRegistered, resetScanner, terminalEnabled]);

  useEffect(() => {
    const timer = window.setInterval(processCamera, 900);
    return () => window.clearInterval(timer);
  }, [processCamera]);

  const handleCameraError = useCallback((error) => {
    setDetail(error?.name === 'NotAllowedError' ? 'Debes autorizar el uso de la camara.' : 'No fue posible iniciar la camara.');
    setStatus('cameraError');
  }, []);

  return (
    <section className="attendance-scanner-card">
      <CameraFeed
        ref={cameraRef}
        status={status}
        onCameraError={handleCameraError}
      />
      <RecognitionStatus status={status} result={result} detail={detail} />
    </section>
  );
}

function normalizeRecognitionError(error) {
  const message = error?.message || '';
  if (message.includes('resource-exhausted')) return 'Ya existe una marcacion reciente. Espera un momento.';
  if (message.includes('ultima marcacion') || message.includes('última marcación')) return message;
  if (message.includes('consentimiento')) return 'El trabajador no tiene consentimiento biometrico registrado.';
  if (message.includes('Rostro no reconocido')) return message;
  return `No fue posible completar el marcaje: ${message || 'intentalo nuevamente.'}`;
}
