export const documentTypes = [
  { id: 'Curriculum vitae', label: 'Curriculum vitae', required: true, group: 'Ingreso', expires: false, aliases: ['Curriculum'] },
  { id: 'Cedula de identidad', label: 'Cedula de identidad por ambos lados', required: true, group: 'Identidad', expires: true, aliases: ['Carnet'] },
  { id: 'Certificado de antecedentes', label: 'Certificado de antecedentes vigente', required: true, group: 'Ingreso', expires: true, aliases: ['Certificados'] },
  { id: 'Certificado de estudios', label: 'Certificado de estudios o titulo', required: true, group: 'Ingreso', expires: false, aliases: ['Titulo profesional'] },
  { id: 'Ultimo finiquito', label: 'Ultimo finiquito', required: false, group: 'Laboral', expires: false },
  { id: 'Afiliacion AFP', label: 'Certificado de afiliacion AFP vigente', required: true, group: 'Prevision', expires: true },
  { id: 'Cotizaciones AFP', label: 'Certificado de cotizaciones AFP', required: true, group: 'Prevision', expires: true },
  { id: 'Afiliacion Salud', label: 'Certificado de afiliacion a salud vigente', required: true, group: 'Prevision', expires: true },
  { id: 'Certificado de residencia', label: 'Certificado de residencia', required: true, group: 'Ingreso', expires: true },
  { id: 'Carga familiar', label: 'Nacimiento carga familiar y estudios', required: false, group: 'Cargas', expires: true },
  { id: 'Contrato', label: 'Contrato de trabajo firmado', required: true, group: 'Contrato', expires: false },
  { id: 'Anexos', label: 'Anexos de contrato', required: false, group: 'Contrato', expires: false },
  { id: 'Licencias', label: 'Licencias medicas', required: false, group: 'Ausencias', expires: true },
  { id: 'Otros', label: 'Otros documentos', required: false, group: 'Otros', expires: false },
];

export const requiredDocumentTypes = documentTypes.filter((item) => item.required);

export function documentTypeFor(category) {
  return documentTypes.find((item) => (
    item.id === category
    || item.label === category
    || item.aliases?.includes(category)
  ));
}

export function requiredDocumentStatus(documents = []) {
  const presentIds = new Set(
    documents
      .map((item) => documentTypeFor(item.category)?.id)
      .filter(Boolean),
  );
  const missing = requiredDocumentTypes.filter((item) => !presentIds.has(item.id));
  const ready = requiredDocumentTypes.length - missing.length;
  return {
    ready,
    total: requiredDocumentTypes.length,
    missing,
    completion: requiredDocumentTypes.length
      ? Math.round((ready / requiredDocumentTypes.length) * 100)
      : 100,
  };
}
