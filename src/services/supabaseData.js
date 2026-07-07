import { supabase, supabaseConfigured } from '../supabase';

function ensureSupabase() {
  if (!supabaseConfigured || !supabase) {
    throw new Error('Supabase no esta configurado. Revisa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
  }
}

const tableMap = {
  employees: {
    employeeCode: 'employee_code',
    contractType: 'contract_type',
    workLocation: 'work_location',
    scheduleEnd: 'schedule_end',
    weeklyHours: 'weekly_hours',
    supervisor: 'supervisor',
    supervisorWhatsapp: 'supervisor_whatsapp',
    emergencyContact: 'emergency_contact',
    emergencyPhone: 'emergency_phone',
    startDate: 'start_date',
    contractDate: 'contract_date',
    scheduleStart: 'schedule_start',
    biometricConsent: 'biometric_consent',
    biometricEnrolled: 'biometric_enrolled',
    biometricUpdatedAt: 'biometric_updated_at',
    baseSalary: 'base_salary',
    photoUrl: 'photo_url',
    userUid: 'user_uid',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  documents: {
    employeeId: 'employee_id',
    employeeName: 'employee_name',
    ownerEmail: 'owner_email',
    expiryDate: 'expiry_date',
    fileName: 'file_name',
    storagePath: 'storage_path',
    storageBucket: 'storage_bucket',
    storageProvider: 'storage_provider',
    contentType: 'content_type',
    uploadedAt: 'uploaded_at',
    uploadedBy: 'uploaded_by',
    notificationState: 'notification_state',
  },
  attendance: {
    employeeId: 'employee_id',
    employeeName: 'employee_name',
    photoUrl: 'photo_url',
    ownerEmail: 'owner_email',
    userUid: 'user_uid',
    dateKey: 'date_key',
    createdAt: 'created_at',
  },
  biometricProfiles: {
    employeeId: 'employee_id',
    employeeName: 'employee_name',
    sampleCount: 'sample_count',
    updatedAt: 'updated_at',
  },
  hrRequests: {
    employeeId: 'employee_id',
    employeeName: 'employee_name',
    ownerEmail: 'owner_email',
    fromDate: 'from_date',
    toDate: 'to_date',
    createdBy: 'created_by',
    reviewedBy: 'reviewed_by',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  payroll: {
    employeeId: 'employee_id',
    employeeName: 'employee_name',
    ownerEmail: 'owner_email',
    baseSalary: 'base_salary',
    netPay: 'net_pay',
    updatedBy: 'updated_by',
    updatedAt: 'updated_at',
  },
  notifications: {
    recipientUid: 'recipient_uid',
    ownerEmail: 'owner_email',
    createdAt: 'created_at',
  },
  profiles: {
    displayName: 'display_name',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
};

const tableNames = {
  biometricProfiles: 'biometric_profiles',
  hrRequests: 'hr_requests',
};

function dbTable(table) {
  return tableNames[table] || table;
}

function toDb(table, row) {
  const map = tableMap[table] || {};
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [map[key] || key, value === '' ? null : value]));
}

export function fromDb(table, row) {
  if (!row) return row;
  const map = tableMap[table] || {};
  const reverse = Object.fromEntries(Object.entries(map).map(([key, value]) => [value, key]));
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [reverse[key] || key, value]));
}

export async function listRows(table, { filters = [], orderBy = 'created_at', ascending = false } = {}) {
  ensureSupabase();
  let request = supabase.from(dbTable(table)).select('*');
  filters.forEach(([column, value]) => {
    request = request.eq((tableMap[table] || {})[column] || column, value);
  });
  if (orderBy) request = request.order((tableMap[table] || {})[orderBy] || orderBy, { ascending });
  const { data, error } = await request;
  if (error) throw error;
  return (data || []).map((row) => fromDb(table, row));
}

export async function insertRow(table, payload) {
  ensureSupabase();
  const { data, error } = await supabase.from(dbTable(table)).insert(toDb(table, payload)).select('*').single();
  if (error) throw error;
  return fromDb(table, data);
}

export async function upsertRow(table, payload, { onConflict = 'id' } = {}) {
  ensureSupabase();
  const { data, error } = await supabase
    .from(dbTable(table))
    .upsert(toDb(table, payload), { onConflict })
    .select('*')
    .single();
  if (error) throw error;
  return fromDb(table, data);
}

export async function updateRow(table, id, payload) {
  ensureSupabase();
  const updatePayload = { ...payload };
  if ((tableMap[table] || {}).updatedAt) updatePayload.updatedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from(dbTable(table))
    .update(toDb(table, updatePayload))
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return fromDb(table, data);
}

export async function deleteRow(table, id) {
  ensureSupabase();
  const { error } = await supabase.from(dbTable(table)).delete().eq('id', id);
  if (error) throw error;
}

export function subscribeRows(table, callback, options = {}) {
  let cancelled = false;
  const load = () => listRows(table, options).then((rows) => !cancelled && callback(rows)).catch(console.error);
  load();
  if (!supabaseConfigured || !supabase) return () => { cancelled = true; };
  const channel = supabase
    .channel(`${dbTable(table)}-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: dbTable(table) }, load)
    .subscribe();
  return () => {
    cancelled = true;
    supabase.removeChannel(channel);
  };
}

export async function updateProfile(userId, payload) {
  ensureSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .update({
      display_name: String(payload.displayName || '').slice(0, 60),
      bio: String(payload.bio || '').slice(0, 280),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return fromDb('profiles', data);
}
