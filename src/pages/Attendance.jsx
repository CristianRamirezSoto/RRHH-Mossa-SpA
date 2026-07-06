import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AttendanceScanner } from '../components/attendance/AttendanceScanner';
import { AttendanceClock } from '../components/attendance/AttendanceClock';
import { RecentAttendanceList } from '../components/attendance/RecentAttendanceList';
import { DailyAttendanceSummary } from '../components/attendance/DailyAttendanceSummary';
import { Icon } from '../components/AppLayout';
import { subscribeRows } from '../services/supabaseData';

export function Attendance({ terminalMode = false }) {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [markType, setMarkType] = useState('entry');
  const todayKey = dateKey(new Date());

  useEffect(() => {
    return subscribeRows('attendance', setRecords, {
      filters: [['dateKey', todayKey]],
      orderBy: 'createdAt',
      ascending: false,
    });
  }, [todayKey]);

  useEffect(() => subscribeRows('employees', setEmployees, { orderBy: 'name', ascending: true }), []);

  const summary = useMemo(() => {
    const latestByEmployee = new Map();
    records
      .slice()
      .sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt))
      .forEach((record) => {
        if (!latestByEmployee.has(record.employeeId)) latestByEmployee.set(record.employeeId, record);
      });

    const presentIds = new Set(
      [...latestByEmployee.values()]
        .filter((item) => item.type === 'entry')
        .map((item) => item.employeeId)
    );

    return {
      present: presentIds.size,
      absent: Math.max(0, employees.filter((item) => item.status === 'Activo').length - presentIds.size),
      late: new Set(records.filter((item) => item.status === 'late').map((item) => item.employeeId)).size,
      marks: records.length,
    };
  }, [employees, records]);

  const attendanceReadiness = useMemo(() => {
    const activeEmployees = employees.filter((employee) => employee.status === 'Activo');
    const enrolled = activeEmployees.filter((employee) => employee.biometricEnrolled).length;
    const consentPending = activeEmployees.filter((employee) => !employee.biometricConsent).length;
    const enrollmentPending = activeEmployees.filter((employee) => employee.biometricConsent && !employee.biometricEnrolled).length;
    return {
      active: activeEmployees.length,
      enrolled,
      consentPending,
      enrollmentPending,
      ready: activeEmployees.length > 0 && enrolled === activeEmployees.length,
    };
  }, [employees]);

  function openTerminalMode() {
    const pin = window.prompt('Crea un PIN de 4 dígitos para salir del modo terminal:');
    if (!/^\d{4}$/.test(pin || '')) return;
    window.sessionStorage.setItem('attendance-terminal-pin', pin);
    navigate('/terminal/marcaje');
    window.document.documentElement.requestFullscreen?.().catch(() => {});
  }

  function exitTerminalMode() {
    const expectedPin = window.sessionStorage.getItem('attendance-terminal-pin');
    const pin = window.prompt('Ingresa el PIN para salir del modo terminal:');
    if (pin !== expectedPin) return;
    window.sessionStorage.removeItem('attendance-terminal-pin');
    window.document.exitFullscreen?.().catch(() => {});
    navigate('/marcaje');
  }

  return (
    <div className={`page attendance-page${terminalMode ? ' attendance-terminal-page' : ''}`}>
      <header className="attendance-page-header">
        <div>
          <p className="eyebrow">Control de asistencia</p>
          <h1>Marcaje de Asistencia</h1>
          <p>Selecciona entrada o salida y registra mediante reconocimiento facial.</p>
        </div>
        <div className="attendance-header-actions">
          <AttendanceClock />
          {terminalMode
            ? <button className="terminal-exit-button" type="button" onClick={exitTerminalMode}>Salir del terminal</button>
            : <button className="secondary-button" type="button" onClick={openTerminalMode}>Abrir modo terminal</button>}
        </div>
      </header>

      <section className="attendance-mode-card" aria-label="Tipo de marcación">
        <div>
          <span className="attendance-mode-eyebrow">Acción preparada</span>
          <strong>{markType === 'entry' ? 'Registrar entrada' : 'Registrar salida'}</strong>
          <p>La cámara identificará al trabajador, pero el tipo de marcación lo controlas aquí.</p>
        </div>
        <div className="attendance-mode-toggle">
          <button
            className={markType === 'entry' ? 'active' : ''}
            type="button"
            onClick={() => setMarkType('entry')}
          >
            <Icon name="login" />
            Entrada
          </button>
          <button
            className={markType === 'exit' ? 'active' : ''}
            type="button"
            onClick={() => setMarkType('exit')}
          >
            <Icon name="logout" />
            Salida
          </button>
        </div>
      </section>

      {!terminalMode && (
        <section className={`workflow-notice ${attendanceReadiness.ready ? 'ready' : 'warning'}`}>
          <span className="workflow-notice-icon"><Icon name={attendanceReadiness.ready ? 'check' : 'alert'} /></span>
          <div className="workflow-notice-copy">
            <strong>{attendanceReadiness.ready ? 'Marcaje listo para operar' : 'Antes de marcar, completa los pendientes biometricos'}</strong>
            <p>
              {attendanceReadiness.enrolled}/{attendanceReadiness.active} trabajadores activos enrolados.
              {attendanceReadiness.consentPending ? ` ${attendanceReadiness.consentPending} sin consentimiento.` : ''}
              {attendanceReadiness.enrollmentPending ? ` ${attendanceReadiness.enrollmentPending} con consentimiento, pendientes de enrolar.` : ''}
            </p>
          </div>
          <div className="workflow-notice-actions">
            <button className="secondary-button" type="button" onClick={() => navigate('/colaboradores')}>
              <Icon name="users" /> Revisar fichas
            </button>
            <button className="primary-button" type="button" onClick={() => navigate('/biometria')}>
              <Icon name="scan" /> Enrolar
            </button>
          </div>
        </section>
      )}

      <section className="attendance-main-grid">
        <AttendanceScanner markType={markType} />
        <RecentAttendanceList records={records} />
      </section>

      <DailyAttendanceSummary summary={summary} />
    </div>
  );
}

function dateKey(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function timestampValue(value) { return value ? new Date(value).getTime() : 0; }
