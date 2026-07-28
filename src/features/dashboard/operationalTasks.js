import { requiredDocumentStatus } from '../documents/documentCatalog';

const DAY = 86400000;
const priorityRank = { critical: 0, high: 1, medium: 2 };

export function buildAdminTasks({
  employees = [],
  documents = [],
  requests = [],
  payroll = [],
  now = new Date(),
}) {
  const tasks = [];
  const activeEmployees = employees.filter((item) => item.status !== 'Inactivo');

  requests
    .filter((item) => item.status === 'Pendiente')
    .forEach((request) => {
      const age = elapsedDays(request.createdAt, now);
      const waitingSupervisor = request.supervisorStatus === 'Pendiente';
      tasks.push({
        id: `request-${request.id}`,
        category: 'Solicitudes',
        icon: 'calendar',
        priority: waitingSupervisor ? 'medium' : age >= 3 ? 'critical' : 'high',
        title: `${request.type} de ${request.employeeName}`,
        detail: requestDetail(request),
        reason: waitingSupervisor
          ? `Espera visto bueno de ${request.supervisorName || 'supervisor'}`
          : age ? `Espera hace ${age} día${age === 1 ? '' : 's'}` : 'Recibida hoy',
        action: waitingSupervisor ? 'Ver seguimiento' : 'Resolver',
        to: '/solicitudes',
        timestamp: timestampValue(request.createdAt),
      });
    });

  documents.forEach((document) => {
    const expiry = expiryStatus(document.expiryDate, now);
    if (!['expired', 'soon'].includes(expiry.type)) return;
    tasks.push({
      id: `document-${document.id}`,
      category: 'Documentos',
      icon: 'file',
      priority: expiry.type === 'expired' ? 'critical' : 'high',
      title: `${document.employeeName}: ${document.category}`,
      detail: expiry.type === 'expired' ? 'Documento vencido' : 'Documento próximo a vencer',
      reason: expiry.label,
      action: 'Regularizar',
      to: `/expedientes/${document.employeeId}`,
      timestamp: document.expiryDate ? new Date(`${document.expiryDate}T12:00:00`).getTime() : 0,
    });
  });

  activeEmployees.forEach((employee) => {
    const employeeDocuments = documents.filter((item) => item.employeeId === employee.id);
    const required = requiredDocumentStatus(employeeDocuments);
    if (required.missing.length) {
      tasks.push({
        id: `file-${employee.id}`,
        category: 'Onboarding',
        icon: 'folder',
        priority: required.missing.length >= 4 ? 'high' : 'medium',
        title: `${employee.name}: carpeta ${required.completion}%`,
        detail: `Faltan ${required.missing.length} documento${required.missing.length === 1 ? '' : 's'} obligatorio${required.missing.length === 1 ? '' : 's'}`,
        reason: required.missing.slice(0, 2).map((item) => item.label).join(' · '),
        action: 'Completar',
        to: `/expedientes/${employee.id}`,
        timestamp: timestampValue(employee.updatedAt || employee.createdAt),
      });
    }

    const missingProfile = [
      ['cargo', employee.position],
      ['área', employee.area],
      ['sede', employee.workLocation],
      ['fecha de ingreso', employee.startDate],
    ].filter(([, value]) => !value).map(([label]) => label);

    if (employee.status === 'Pendiente' || missingProfile.length) {
      tasks.push({
        id: `employee-${employee.id}`,
        category: 'Ficha laboral',
        icon: 'user',
        priority: employee.status === 'Pendiente' ? 'high' : 'medium',
        title: `${employee.name}: ficha por completar`,
        detail: employee.status === 'Pendiente' ? 'Colaborador aún pendiente de activación' : `Falta ${missingProfile.join(', ')}`,
        reason: 'Evita consultas y errores posteriores',
        action: 'Editar ficha',
        to: '/colaboradores',
        timestamp: timestampValue(employee.updatedAt || employee.createdAt),
      });
    }

    if (employee.status === 'Activo' && employee.biometricConsent && !employee.biometricEnrolled) {
      tasks.push({
        id: `biometric-${employee.id}`,
        category: 'Biometría',
        icon: 'face',
        priority: 'medium',
        title: `${employee.name}: enrolamiento pendiente`,
        detail: 'Consentimiento registrado, plantilla facial pendiente',
        reason: 'No podrá usar marcaje facial',
        action: 'Enrolar',
        to: `/biometria/${employee.id}`,
        timestamp: timestampValue(employee.updatedAt || employee.createdAt),
      });
    }
  });

  const pendingPayroll = payroll.filter((item) => ['Listo para pago', 'Pendiente pago'].includes(item.status));
  const payrollByPeriod = pendingPayroll.reduce((result, item) => {
    const period = item.period || 'actual';
    result[period] = result[period] || { count: 0, amount: 0, timestamp: 0 };
    result[period].count += 1;
    result[period].amount += Number(item.netPay || 0);
    result[period].timestamp = Math.max(result[period].timestamp, timestampValue(item.updatedAt));
    return result;
  }, {});

  Object.entries(payrollByPeriod).forEach(([period, info]) => {
    tasks.push({
      id: `payroll-${period}`,
      category: 'Remuneraciones',
      icon: 'wallet',
      priority: info.count >= 3 ? 'high' : 'medium',
      title: `${info.count} pago${info.count === 1 ? '' : 's'} por cerrar`,
      detail: `${formatPeriod(period)} · ${formatMoney(info.amount)}`,
      reason: 'Adjunta comprobantes y cierra el periodo',
      action: 'Revisar pagos',
      to: '/remuneraciones',
      timestamp: info.timestamp,
    });
  });

  return tasks.sort((a, b) => (
    priorityRank[a.priority] - priorityRank[b.priority]
    || a.timestamp - b.timestamp
    || a.title.localeCompare(b.title, 'es')
  ));
}

export function taskSummary(tasks = []) {
  return {
    total: tasks.length,
    critical: tasks.filter((item) => item.priority === 'critical').length,
    high: tasks.filter((item) => item.priority === 'high').length,
    medium: tasks.filter((item) => item.priority === 'medium').length,
    health: Math.max(
      0,
      100
        - tasks.filter((item) => item.priority === 'critical').length * 12
        - tasks.filter((item) => item.priority === 'high').length * 6
        - tasks.filter((item) => item.priority === 'medium').length * 2,
    ),
  };
}

function elapsedDays(value, now) {
  if (!value) return 0;
  return Math.max(0, Math.floor((now.getTime() - new Date(value).getTime()) / DAY));
}

function expiryStatus(value, now) {
  if (!value) return { type: 'none', label: 'Sin vencimiento' };
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(`${value}T00:00:00`);
  const days = Math.ceil((expiry - today) / DAY);
  if (days < 0) return { type: 'expired', label: `Venció hace ${Math.abs(days)} día${Math.abs(days) === 1 ? '' : 's'}` };
  if (days <= 30) return { type: 'soon', label: days === 0 ? 'Vence hoy' : `Vence en ${days} días` };
  return { type: 'ok', label: 'Vigente' };
}

function timestampValue(value) {
  return value ? new Date(value).getTime() : 0;
}

function formatDate(value) {
  return value
    ? new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short' }).format(new Date(`${value}T12:00:00`))
    : 'Sin fecha';
}

function requestDetail(request) {
  const usesRange = ['Vacaciones', 'Permiso', 'Licencia', 'Horas extra', 'Ausencia'].includes(request.type);
  return usesRange
    ? `${formatDate(request.fromDate)} al ${formatDate(request.toDate)}`
    : `Registrada ${formatDate(request.fromDate)}`;
}

function formatPeriod(period) {
  if (!/^\d{4}-\d{2}$/.test(period)) return 'Periodo actual';
  const [year, month] = period.split('-').map(Number);
  return new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

function formatMoney(value) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}
