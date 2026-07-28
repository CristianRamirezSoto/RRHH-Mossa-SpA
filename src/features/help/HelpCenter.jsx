import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/AppLayout';
import { useAuth } from '../../context/AuthContext';
import './HelpCenter.css';

const workerActions = [
  { to: '/expediente', icon: 'folder', title: 'Descargar documentos', text: 'Accede a contratos, certificados y antecedentes disponibles.' },
  { to: '/solicitudes', icon: 'calendar', title: 'Crear una solicitud', text: 'Registra vacaciones, permisos, certificados o correcciones.' },
  { to: '/mis-pagos', icon: 'wallet', title: 'Revisar liquidaciones', text: 'Consulta periodos liberados y descarga sus respaldos.' },
  { to: '/mi-ficha', icon: 'briefcase', title: 'Revisar mi ficha', text: 'Actualiza tus contactos y consulta contrato, jornada y supervisor.' },
];

const adminActions = [
  { to: '/colaboradores', icon: 'users', title: 'Ordenar incorporaciones', text: 'Completa ficha, cargo, área, sede y responsable directo.' },
  { to: '/cuentas', icon: 'key', title: 'Gestionar accesos', text: 'Crea, activa, suspende, cambia permisos o elimina cuentas.' },
  { to: '/expedientes', icon: 'folder', title: 'Completar expedientes', text: 'Sube, descarga y depura documentos por colaborador.' },
  { to: '/panel', icon: 'alert', title: 'Priorizar pendientes', text: 'Trabaja desde la bandeja unificada por impacto y antigüedad.' },
];

const workerTopics = [
  {
    title: '¿Cómo descargo un documento?',
    answer: 'Entra a Mis documentos, abre tu expediente y usa Descargar en el archivo que necesites. Tu cuenta de colaborador sólo puede consultar y descargar sus propios documentos.',
    keywords: 'contrato certificado archivo expediente descargar',
  },
  {
    title: 'Mi expediente aparece incompleto',
    answer: 'La barra de avance usa el catálogo obligatorio de la empresa. Revisa los documentos faltantes y crea una solicitud de Regularización documental indicando cuáles necesitas incorporar.',
    keywords: 'faltante carpeta regularizacion documento porcentaje',
  },
  {
    title: '¿Cómo solicito vacaciones, permisos o un certificado?',
    answer: 'Ve a Solicitudes, elige el tipo, completa fechas y detalle, y envíala. El estado y cualquier respaldo de resolución quedarán disponibles en la misma pantalla.',
    keywords: 'vacaciones permiso licencia certificado solicitud estado',
  },
  {
    title: 'No veo mi ficha laboral',
    answer: 'Entra a Mi ficha laboral. Si no aparece, comprueba que tu cuenta use el mismo correo corporativo registrado por Administración y solicita la vinculación desde el Centro de ayuda.',
    keywords: 'vincular ficha correo cuenta datos',
  },
  {
    title: '¿Qué datos puedo actualizar yo?',
    answer: 'Desde Mi ficha laboral puedes cambiar teléfono, correo personal, dirección, comuna y contacto de emergencia. Para nombre legal, RUT, cargo, contrato, jornada, sueldo o supervisor debes crear una Corrección de ficha laboral.',
    keywords: 'actualizar telefono direccion comuna emergencia contrato sueldo supervisor',
  },
  {
    title: 'No aparece una liquidación',
    answer: 'Sólo se muestran periodos liberados para tu correo. Revisa el periodo y crea una solicitud si un mes ya pagado no aparece en el portal.',
    keywords: 'sueldo remuneracion liquidacion pago periodo',
  },
  {
    title: '¿Quién puede ver mis documentos?',
    answer: 'Tú puedes consultar tus propios archivos. Los administradores autorizados pueden gestionarlos para mantener tu expediente laboral. Otros colaboradores no tienen acceso.',
    keywords: 'privacidad seguridad permisos acceso documentos',
  },
];

const adminTopics = [
  {
    title: '¿Por dónde empiezo cada jornada?',
    answer: 'Usa la Bandeja operativa del Inicio. Allí se mezclan solicitudes antiguas, documentos vencidos o faltantes, fichas incompletas, biometría pendiente y remuneraciones por cerrar.',
    keywords: 'prioridad bandeja tareas pendientes ordenar',
  },
  {
    title: '¿Cuál es el orden correcto para incorporar a una persona?',
    answer: 'Primero crea la ficha completa, luego su cuenta con rol de colaborador, completa el expediente obligatorio y finalmente registra biometría si corresponde. Usa el mismo correo en ficha y cuenta.',
    keywords: 'onboarding incorporar nuevo colaborador cuenta ficha',
  },
  {
    title: '¿Cómo controlo cuentas y permisos?',
    answer: 'En Usuarios y permisos puedes crear cuentas, cambiar el rol, suspender, reactivar o eliminar. Verifica siempre el correo y evita entregar rol administrador sin necesidad operacional.',
    keywords: 'cuenta usuario rol admin suspender eliminar activar',
  },
  {
    title: '¿Cómo cierro una solicitud?',
    answer: 'Abre Solicitudes, revisa la más antigua, aprueba o rechaza y agrega un comentario claro. Al aprobar, adjunta el respaldo para que el trabajador pueda descargarlo sin pedirlo por otro canal.',
    keywords: 'aprobar rechazar solicitud respaldo trazabilidad',
  },
  {
    title: '¿Quién modifica cada parte de la ficha laboral?',
    answer: 'El trabajador mantiene sus datos personales desde Mi ficha laboral. Administración controla los antecedentes legales, organizacionales y contractuales. Cada modificación queda registrada en el historial de la ficha.',
    keywords: 'ficha datos administrador trabajador historial contrato contacto',
  },
  {
    title: '¿Cómo mantengo los expedientes ordenados?',
    answer: 'Trabaja por las alertas de documentos obligatorios y vencimientos. Usa una categoría correcta, una fecha de vigencia cuando aplique y elimina duplicados o archivos incorrectos desde la vista administrativa.',
    keywords: 'expediente documento categoria vencimiento eliminar duplicado',
  },
  {
    title: '¿Qué reviso antes de liberar remuneraciones?',
    answer: 'Confirma periodo, identidad del colaborador, montos y respaldo. Sólo libera el registro final; así el trabajador lo verá en su portal sin consultas manuales a RRHH.',
    keywords: 'pago sueldo remuneracion liquidacion liberar',
  },
];

export function HelpCenter() {
  const { profile } = useAuth();
  const [query, setQuery] = useState('');
  const isAdmin = profile?.role === 'admin';
  const actions = isAdmin ? adminActions : workerActions;
  const topics = isAdmin ? adminTopics : workerTopics;
  const visibleTopics = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es');
    if (!normalized) return topics;
    return topics.filter((item) => (
      `${item.title} ${item.answer} ${item.keywords}`.toLocaleLowerCase('es').includes(normalized)
    ));
  }, [query, topics]);

  return (
    <div className="page help-page">
      <section className="help-hero">
        <div>
          <span className="portal-kicker"><Icon name="help" size={16} /> Centro de ayuda</span>
          <h1>{isAdmin ? 'Guía para una operación ordenada' : 'Resuelve desde tu portal'}</h1>
          <p>{isAdmin
            ? 'Procesos breves y enlaces directos para administrar personas con menos seguimiento manual.'
            : 'Encuentra respuestas y completa tus trámites sin esperar una respuesta por correo o mensajería.'}</p>
        </div>
        <label className="help-search">
          <Icon name="search" size={18} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar documentos, permisos, cuentas…"
            aria-label="Buscar en el centro de ayuda"
          />
        </label>
      </section>

      <section className="help-action-grid" aria-label="Accesos de resolución rápida">
        {actions.map((action) => (
          <Link to={action.to} key={action.to}>
            <span><Icon name={action.icon} size={19} /></span>
            <div><strong>{action.title}</strong><p>{action.text}</p></div>
            <Icon name="arrow" size={15} />
          </Link>
        ))}
      </section>

      <section className="help-content-grid">
        <article className="panel help-faq-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Base de conocimiento</p>
              <h2>Preguntas frecuentes</h2>
              <p>{visibleTopics.length} respuestas disponibles</p>
            </div>
          </div>
          <div className="help-faq-list">
            {visibleTopics.map((topic) => (
              <details key={topic.title}>
                <summary>{topic.title}<Icon name="plus" size={15} /></summary>
                <p>{topic.answer}</p>
              </details>
            ))}
            {!visibleTopics.length && (
              <div className="portal-empty">
                <Icon name="search" size={25} />
                <p>No encontramos esa respuesta. Prueba con otra palabra o usa la ruta de escalamiento.</p>
              </div>
            )}
          </div>
        </article>

        <aside className="help-escalation-card">
          <span><Icon name="shield" size={23} /></span>
          <p className="eyebrow">Antes de escalar</p>
          <h2>Evita solicitudes duplicadas</h2>
          <ol>
            <li>Busca la respuesta en esta guía.</li>
            <li>Revisa tus notificaciones y el estado existente.</li>
            <li>Confirma correo, periodo y documento involucrado.</li>
          </ol>
          <div>
            <strong>¿Aún necesitas apoyo?</strong>
            <p>{isAdmin
              ? 'Revisa las alertas generadas por el sistema y documenta la resolución.'
              : 'Crea una solicitud con el tipo correcto y toda la información necesaria.'}</p>
            <Link to={isAdmin ? '/notificaciones' : '/solicitudes'}>
              {isAdmin ? 'Ver alertas operativas' : 'Crear solicitud'} <Icon name="arrow" size={14} />
            </Link>
          </div>
        </aside>
      </section>
    </div>
  );
}
