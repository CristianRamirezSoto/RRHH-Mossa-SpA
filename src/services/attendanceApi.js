import { supabase, supabaseConfigured } from '../supabase';
import { updateProfile } from './supabaseData';

function ensureSupabase() {
  if (!supabaseConfigured || !supabase) {
    throw new Error('Supabase no esta configurado.');
  }
}

export async function listBiometricProfiles() {
  ensureSupabase();
  const { data, error } = await supabase.from('biometric_profiles').select('*');
  if (error) throw error;
  return (data || []).map((item) => ({
    employeeId: item.employee_id,
    employeeName: item.employee_name,
    descriptor: item.descriptor,
    model: item.model,
  }));
}

export async function saveBiometricProfile(employeeId, descriptor, sampleCount) {
  ensureSupabase();
  if (!employeeId || !Array.isArray(descriptor)) {
    throw new Error('Plantilla biometrica invalida.');
  }

  const { data: employee, error: employeeError } = await supabase
    .from('employees')
    .select('*')
    .eq('id', employeeId)
    .single();
  if (employeeError) throw employeeError;
  if (employee.status !== 'Activo') throw new Error('El trabajador no esta activo.');
  if (employee.biometric_consent !== true) {
    throw new Error('El trabajador no tiene consentimiento biometrico registrado.');
  }

  const { error: profileError } = await supabase.from('biometric_profiles').upsert({
    employee_id: employeeId,
    employee_name: employee.name,
    descriptor,
    sample_count: Number(sampleCount || 0),
    model: '@vladmandic/human:faceres',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'employee_id' });
  if (profileError) throw profileError;

  const { error: updateError } = await supabase
    .from('employees')
    .update({
      biometric_enrolled: true,
      biometric_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', employeeId);
  if (updateError) throw updateError;

  return { ok: true };
}

export async function registerAttendance(employeeId, confidence, markType) {
  ensureSupabase();
  if (!['entry', 'exit'].includes(markType)) throw new Error('Tipo de marcacion invalido.');
  if (!Number.isFinite(Number(confidence)) || Number(confidence) < 0.62) {
    throw new Error('La coincidencia facial no alcanzo el nivel minimo.');
  }

  const { data: employee, error: employeeError } = await supabase
    .from('employees')
    .select('*')
    .eq('id', employeeId)
    .single();
  if (employeeError) throw employeeError;
  if (employee.status !== 'Activo') throw new Error('El trabajador no esta activo.');
  if (employee.biometric_consent !== true) {
    throw new Error('El trabajador no tiene consentimiento biometrico registrado.');
  }

  const now = new Date();
  const dateKey = chileDateKey(now);
  const stateId = `${employeeId}_${dateKey}`;
  const { data: state, error: stateError } = await supabase
    .from('attendance_state')
    .select('*')
    .eq('id', stateId)
    .maybeSingle();
  if (stateError) throw stateError;

  if (state?.last_type === markType) {
    throw new Error(
      markType === 'entry'
        ? 'La ultima marcacion de este trabajador ya fue una entrada.'
        : 'La ultima marcacion de este trabajador ya fue una salida.'
    );
  }

  if (state?.last_at && now.getTime() - new Date(state.last_at).getTime() < 20_000) {
    throw new Error('Ya existe una marcacion reciente para este trabajador.');
  }

  const status = markType === 'entry' && isLate(now, employee.schedule_start || '08:00') ? 'late' : 'ok';
  const mark = {
    employee_id: employeeId,
    employee_name: employee.name,
    position: employee.position || '',
    photo_url: employee.photo_url || '',
    owner_email: (employee.email || '').toLowerCase(),
    user_uid: employee.user_uid || null,
    type: markType,
    status,
    confidence: Math.max(0, Math.min(1, Number(confidence || 0))),
    date_key: dateKey,
    source: 'facial-recognition',
    created_at: now.toISOString(),
  };

  const { data: attendance, error: attendanceError } = await supabase
    .from('attendance')
    .insert(mark)
    .select('*')
    .single();
  if (attendanceError) throw attendanceError;

  const { error: stateUpdateError } = await supabase.from('attendance_state').upsert({
    id: stateId,
    employee_id: employeeId,
    date_key: dateKey,
    last_type: markType,
    last_at: now.toISOString(),
    last_attendance_id: attendance.id,
  }, { onConflict: 'id' });
  if (stateUpdateError) throw stateUpdateError;

  return {
    ok: true,
    attendanceId: attendance.id,
    employeeName: employee.name,
    type: markType,
    typeLabel: markType === 'entry' ? 'Entrada' : 'Salida',
    status,
    timeLabel: new Intl.DateTimeFormat('es-CL', {
      timeZone: 'America/Santiago',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now),
  };
}

export async function updateEmployeeProfile(userId, payload) {
  return updateProfile(userId, payload);
}

function chileDateKey(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function isLate(date, scheduleStart) {
  const [hour = 8, minute = 0] = String(scheduleStart).split(':').map(Number);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const limit = new Date(`${values.year}-${values.month}-${values.day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00-04:00`);
  return date.getTime() > limit.getTime();
}
