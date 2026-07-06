import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CameraFeed } from '../components/attendance/CameraFeed';
import { Icon } from '../components/AppLayout';
import {
  analyzeFace,
  biometricQuality,
  challengeCompleted,
  createBiometricTemplate,
  loadFaceEngine,
} from '../services/faceEngine';
import { saveBiometricProfile } from '../services/attendanceApi';
import { subscribeRows } from '../services/supabaseData';

const enrollmentSteps = [
  { id: 'center', label: 'Mira directamente a la cámara' },
  { id: 'turn-left', label: 'Gira suavemente el rostro a la izquierda' },
  { id: 'turn-right', label: 'Gira suavemente el rostro a la derecha' },
  { id: 'blink', label: 'Parpadea una vez' },
  { id: 'center-final', label: 'Vuelve a mirar al frente' },
];

export function BiometricEnrollment() {
  const { employeeId } = useParams();
  const cameraRef = useRef(null);
  const runningRef = useRef(false);
  const samplesRef = useRef([]);
  const [employees, setEmployees] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [status, setStatus] = useState('Preparando el motor biométrico local…');
  const [saving, setSaving] = useState(false);

  useEffect(() => subscribeRows('employees', setEmployees, { orderBy: 'name', ascending: true }), []);

  useEffect(() => {
    if (employeeId) setSelectedId(employeeId);
  }, [employeeId]);

  useEffect(() => {
    loadFaceEngine()
      .then(() => setStatus('Selecciona un trabajador para comenzar.'))
      .catch(() => setStatus('No fue posible cargar el motor biométrico.'));
  }, []);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === selectedId),
    [employees, selectedId]
  );

  const enrollmentReadiness = useMemo(() => {
    const activeEmployees = employees.filter((employee) => employee.status === 'Activo');
    const readyToEnroll = activeEmployees.filter((employee) => employee.biometricConsent && !employee.biometricEnrolled);
    const consentPending = activeEmployees.filter((employee) => !employee.biometricConsent);
    const enrolled = activeEmployees.filter((employee) => employee.biometricEnrolled);
    return {
      active: activeEmployees.length,
      readyToEnroll,
      consentPending,
      enrolled: enrolled.length,
    };
  }, [employees]);

  function beginEnrollment() {
    if (!selectedEmployee) {
      setStatus('Selecciona un trabajador.');
      return;
    }
    if (!selectedEmployee.biometricConsent) {
      setStatus('Primero registra el consentimiento biométrico en la ficha del trabajador.');
      return;
    }
    samplesRef.current = [];
    setStepIndex(0);
    setActive(true);
    setStatus(enrollmentSteps[0].label);
  }

  const handleCameraError = useCallback(() => {
    setStatus('No fue posible acceder a la cámara. Revisa permisos del navegador o si otra app la está usando.');
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    const timer = window.setInterval(async () => {
      if (runningRef.current || saving) return;
      const video = cameraRef.current?.getVideoElement();
      if (!video || video.readyState < 2) return;
      runningRef.current = true;
      try {
        const analysis = await analyzeFace(video);
        if (!analysis.detected) {
          setStatus('No vemos un rostro. Acércate y mira la cámara.');
          return;
        }
        const quality = biometricQuality(analysis);
        if (!quality.valid) {
          setStatus(quality.reason);
          return;
        }
        const step = enrollmentSteps[stepIndex];
        if (!enrollmentStepCompleted(step, analysis)) {
          setStatus(step.label);
          return;
        }

        samplesRef.current.push(analysis.descriptor);
        if (stepIndex < enrollmentSteps.length - 1) {
          const nextIndex = stepIndex + 1;
          setStepIndex(nextIndex);
          setStatus(enrollmentSteps[nextIndex].label);
        } else {
          setActive(false);
          setSaving(true);
          setStatus('Protegiendo y guardando la plantilla biométrica…');
          const descriptor = createBiometricTemplate(samplesRef.current);
          await saveBiometricProfile(selectedEmployee.id, descriptor, samplesRef.current.length);
          setStatus(`${selectedEmployee.name} quedó enrolado correctamente.`);
          setSaving(false);
        }
      } catch (error) {
        setActive(false);
        setSaving(false);
        setStatus(error.message || 'No fue posible completar el enrolamiento.');
      } finally {
        runningRef.current = false;
      }
    }, 850);
    return () => window.clearInterval(timer);
  }, [active, saving, selectedEmployee, stepIndex]);

  return (
    <div className="page biometric-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Configuración biométrica</p>
          <h1>Enrolamiento facial</h1>
          <p className="page-subtitle">Registra la plantilla facial de cada trabajador usando varias posiciones y prueba de vida.</p>
        </div>
      </header>

      <section className={`workflow-notice ${enrollmentReadiness.readyToEnroll.length ? 'warning' : 'ready'}`}>
        <span className="workflow-notice-icon"><Icon name={enrollmentReadiness.readyToEnroll.length ? 'alert' : 'check'} /></span>
        <div className="workflow-notice-copy">
          <strong>
            {enrollmentReadiness.readyToEnroll.length
              ? `${enrollmentReadiness.readyToEnroll.length} trabajador${enrollmentReadiness.readyToEnroll.length === 1 ? '' : 'es'} listo${enrollmentReadiness.readyToEnroll.length === 1 ? '' : 's'} para enrolar`
              : 'No hay enrolamientos pendientes listos'}
          </strong>
          <p>
            {enrollmentReadiness.enrolled}/{enrollmentReadiness.active} trabajadores activos enrolados.
            {enrollmentReadiness.consentPending.length ? ` ${enrollmentReadiness.consentPending.length} necesitan consentimiento en su ficha.` : ''}
          </p>
        </div>
        <div className="workflow-notice-actions">
          <button className="secondary-button" type="button" onClick={() => {
            const next = enrollmentReadiness.readyToEnroll[0];
            if (next) setSelectedId(next.id);
          }} disabled={!enrollmentReadiness.readyToEnroll.length || active || saving}>
            <Icon name="scan" /> Seleccionar pendiente
          </button>
        </div>
      </section>

      <section className="biometric-layout">
        <div className="attendance-scanner-card enrollment-camera">
          <CameraFeed
            ref={cameraRef}
            status={active ? 'detected' : 'idle'}
            onCameraError={handleCameraError}
          />
          <div className="enrollment-status">
            <span className="enrollment-step">{active ? `${stepIndex + 1}/${enrollmentSteps.length}` : <Icon name="face" />}</span>
            <div><strong>{active ? enrollmentSteps[stepIndex].label : 'Enrolamiento biométrico'}</strong><p>{status}</p></div>
          </div>
        </div>

        <aside className="panel enrollment-control">
          <div className="panel-heading">
            <div><h2>Trabajador</h2><p>Selecciona a quién deseas enrolar</p></div>
          </div>
          <div className="enrollment-control-body">
            <label className="field">
              <span>Colaborador</span>
              <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} disabled={active || saving}>
                <option value="">Seleccionar trabajador</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}{employee.biometricEnrolled ? ' · Enrolado' : ''}
                  </option>
                ))}
              </select>
            </label>

            {selectedEmployee && (
              <div className="enrollment-person">
                <span className="avatar avatar-soft">{initials(selectedEmployee.name)}</span>
                <div><strong>{selectedEmployee.name}</strong><small>{selectedEmployee.position || 'Sin cargo definido'}</small></div>
                <span className={`enrollment-badge ${selectedEmployee.biometricEnrolled ? 'ready' : ''}`}>
                  {selectedEmployee.biometricEnrolled ? 'Enrolado' : 'Pendiente'}
                </span>
              </div>
            )}

            <div className="enrollment-checks">
              <CheckItem ready={selectedEmployee?.biometricConsent} text="Consentimiento biométrico" />
              <CheckItem ready={selectedEmployee?.status === 'Activo'} text="Trabajador activo" />
              <CheckItem ready={selectedEmployee?.biometricEnrolled} text="Plantilla facial registrada" />
            </div>

            <button className="primary-button enrollment-button" type="button" onClick={beginEnrollment} disabled={active || saving || !selectedEmployee}>
              <Icon name="scan" />
              {selectedEmployee?.biometricEnrolled ? 'Actualizar enrolamiento' : 'Comenzar enrolamiento'}
            </button>
            <p className="biometric-privacy-note"><Icon name="shield" size={15} /> No se almacenan fotografías. Solo una representación matemática protegida.</p>
          </div>
        </aside>
      </section>
    </div>
  );
}

function enrollmentStepCompleted(step, analysis) {
  if (step.id === 'center' || step.id === 'center-final') {
    return Math.abs(Number(analysis.rotation?.yaw || 0)) < 0.13;
  }
  return challengeCompleted(step, analysis);
}

function CheckItem({ ready, text }) {
  return <div className={ready ? 'ready' : ''}><Icon name={ready ? 'check' : 'clock'} size={15} /><span>{text}</span></div>;
}

function initials(name = '') {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '—';
}
