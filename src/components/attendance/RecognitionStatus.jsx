import { Icon } from '../AppLayout';

const statusCopy = {
  idle: {
    title: 'Esperando rostro',
    message: 'Ubícate frente a la cámara para registrar tu asistencia.',
    icon: 'scan',
  },
  detected: {
    title: 'Rostro detectado',
    message: 'Mantén la mirada al frente durante un momento.',
    icon: 'face',
  },
  verifying: {
    title: 'Verificando identidad',
    message: 'Estamos buscando una coincidencia segura.',
    icon: 'scan',
  },
  confirmed: {
    title: 'Identidad confirmada',
    message: 'Preparando el registro de asistencia.',
    icon: 'check',
  },
  registered: {
    title: 'Marcación registrada',
    message: 'Tu asistencia quedó guardada correctamente.',
    icon: 'check',
  },
  error: {
    title: 'No pudimos reconocerte',
    message: 'Mira de frente, evita contraluz e inténtalo nuevamente.',
    icon: 'alert',
  },
  cameraError: {
    title: 'Cámara no disponible',
    message: 'Revisa los permisos del navegador o conecta una webcam.',
    icon: 'camera',
  },
};

export function RecognitionStatus({ status, result, detail }) {
  const copy = statusCopy[status] || statusCopy.idle;

  return (
    <div className={`recognition-status recognition-${status}`}>
      <span className="recognition-status-icon"><Icon name={copy.icon} size={22} /></span>
      <div>
        <strong>{result?.employeeName || copy.title}</strong>
        <p>{detail || (result ? `${result.typeLabel} registrada a las ${result.timeLabel}` : copy.message)}</p>
      </div>
      {status === 'verifying' && <span className="recognition-loader" />}
    </div>
  );
}
