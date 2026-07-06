const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const functionsV1 = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

admin.initializeApp();
const db = getFirestore();

// Se dispara automáticamente cuando alguien crea una cuenta nueva.
// Crea el documento de perfil en Firestore para que el cliente nunca
// tenga que crearlo "a mano".
exports.createUserProfile = functionsV1.auth.user().onCreate(async (user) => {
  const bootstrapRef = db.collection('system').doc('bootstrap');
  const userRef = db.collection('users').doc(user.uid);

  await db.runTransaction(async (transaction) => {
    const bootstrap = await transaction.get(bootstrapRef);
    const role = bootstrap.exists ? 'employee' : 'admin';

    transaction.set(userRef, {
      email: user.email || '',
      displayName: '',
      bio: '',
      role,
      createdAt: FieldValue.serverTimestamp(),
    });

    if (!bootstrap.exists) {
      transaction.set(bootstrapRef, {
        ownerUid: user.uid,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  });
});

// El frontend llama esta función (en vez de escribir directo a Firestore)
// para que la validación viva en el backend, no en el cliente.
exports.updateProfile = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  }

  const { displayName, bio } = request.data;

  if (typeof displayName !== 'string' || displayName.length > 60) {
    throw new HttpsError(
      'invalid-argument',
      'Nombre inválido (máximo 60 caracteres).'
    );
  }
  if (typeof bio !== 'string' || bio.length > 280) {
    throw new HttpsError('invalid-argument', 'Bio inválida (máximo 280 caracteres).');
  }

  await db
    .collection('users')
    .doc(request.auth.uid)
    .set({ displayName, bio }, { merge: true });

  return { ok: true };
});

exports.saveBiometricProfile = onCall(async (request) => {
  await assertAdmin(request.auth);
  const { employeeId, descriptor, sampleCount } = request.data || {};
  if (typeof employeeId !== 'string' || !employeeId) {
    throw new HttpsError('invalid-argument', 'Trabajador inválido.');
  }
  if (!Array.isArray(descriptor) || descriptor.length < 128 || descriptor.length > 2048) {
    throw new HttpsError('invalid-argument', 'El descriptor biométrico no es válido.');
  }
  if (descriptor.some((value) => !Number.isFinite(Number(value)) || Math.abs(Number(value)) > 10)) {
    throw new HttpsError('invalid-argument', 'El descriptor contiene valores inválidos.');
  }

  const employeeRef = db.collection('employees').doc(employeeId);
  const employeeSnapshot = await employeeRef.get();
  if (!employeeSnapshot.exists) {
    throw new HttpsError('not-found', 'El trabajador no existe.');
  }
  if (employeeSnapshot.data().biometricConsent !== true) {
    throw new HttpsError('failed-precondition', 'Debes registrar el consentimiento biométrico antes del enrolamiento.');
  }

  await db.collection('biometricProfiles').doc(employeeId).set({
    employeeId,
    employeeName: employeeSnapshot.data().name,
    descriptor: descriptor.map(Number),
    sampleCount: Math.max(1, Math.min(10, Number(sampleCount || 1))),
    model: 'human-faceres-v3',
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: request.auth.uid,
  });
  await employeeRef.set({
    biometricEnrolled: true,
    biometricEnrolledAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return { ok: true };
});

exports.listBiometricProfiles = onCall(async (request) => {
  await assertAdmin(request.auth);
  const profiles = await db.collection('biometricProfiles').get();
  return {
    profiles: profiles.docs.map((snapshot) => {
      const data = snapshot.data();
      return {
        employeeId: snapshot.id,
        employeeName: data.employeeName,
        descriptor: data.descriptor,
        model: data.model,
      };
    }),
  };
});

exports.registerAttendanceMark = onCall(async (request) => {
  await assertAdmin(request.auth);
  const { employeeId, confidence, markType } = request.data || {};
  if (typeof employeeId !== 'string' || !employeeId) {
    throw new HttpsError('invalid-argument', 'Trabajador inválido.');
  }
  if (!['entry', 'exit'].includes(markType)) {
    throw new HttpsError('invalid-argument', 'Tipo de marcación inválido.');
  }

  const employeeRef = db.collection('employees').doc(employeeId);
  const employeeSnapshot = await employeeRef.get();
  if (!employeeSnapshot.exists || employeeSnapshot.data().status !== 'Activo') {
    throw new HttpsError('not-found', 'El trabajador no existe o está inactivo.');
  }

  const employee = employeeSnapshot.data();
  if (employee.biometricConsent !== true) {
    throw new HttpsError('failed-precondition', 'El trabajador no tiene consentimiento biométrico registrado.');
  }
  const biometricProfile = await db.collection('biometricProfiles').doc(employeeId).get();
  if (!biometricProfile.exists) {
    throw new HttpsError('failed-precondition', 'El trabajador no está enrolado para reconocimiento facial.');
  }
  if (!Number.isFinite(Number(confidence)) || Number(confidence) < 0.62) {
    throw new HttpsError('permission-denied', 'La coincidencia facial no alcanzó el nivel mínimo.');
  }
  const now = new Date();
  const dateKey = chileDateKey(now);
  const stateRef = db.collection('attendanceState').doc(`${employeeId}_${dateKey}`);
  const attendanceRef = db.collection('attendance').doc();

  const result = await db.runTransaction(async (transaction) => {
    const stateSnapshot = await transaction.get(stateRef);
    const state = stateSnapshot.exists ? stateSnapshot.data() : null;
    const lastAt = state?.lastAt?.toDate?.();

    if (state?.lastType === markType) {
      throw new HttpsError(
        'failed-precondition',
        markType === 'entry'
          ? 'La última marcación de este trabajador ya fue una entrada.'
          : 'La última marcación de este trabajador ya fue una salida.'
      );
    }

    if (lastAt && now.getTime() - lastAt.getTime() < 20_000) {
      throw new HttpsError(
        'resource-exhausted',
        'Ya existe una marcación reciente para este trabajador.'
      );
    }

    const type = markType;
    const status = type === 'entry' && isLate(now, employee.scheduleStart || '08:00')
      ? 'late'
      : 'ok';
    const mark = {
      employeeId,
      employeeName: employee.name,
      position: employee.position || '',
      photoUrl: employee.photoUrl || '',
      ownerEmail: (employee.email || '').toLowerCase(),
      userUid: employee.userUid || '',
      type,
      status,
      confidence: Math.max(0, Math.min(1, Number(confidence || 0))),
      dateKey,
      source: 'facial-recognition',
      createdAt: FieldValue.serverTimestamp(),
      registeredBy: request.auth.uid,
    };

    transaction.set(attendanceRef, mark);
    transaction.set(stateRef, {
      employeeId,
      dateKey,
      lastType: type,
      lastAt: FieldValue.serverTimestamp(),
      lastAttendanceId: attendanceRef.id,
    });

    return { type, status };
  });

  return {
    ok: true,
    attendanceId: attendanceRef.id,
    employeeName: employee.name,
    type: result.type,
    typeLabel: result.type === 'entry' ? 'Entrada' : 'Salida',
    status: result.status,
    timeLabel: new Intl.DateTimeFormat('es-CL', {
      timeZone: 'America/Santiago',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now),
  };
});

// Revisa diariamente los documentos con vencimiento y genera tres canales:
// notificación dentro de la app, correo mediante la colección "mail"
// y push móvil para los dispositivos registrados.
exports.checkDocumentExpirations = onSchedule(
  { schedule: 'every day 08:00', timeZone: 'America/Santiago' },
  async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcomingLimit = new Date(today);
    upcomingLimit.setDate(upcomingLimit.getDate() + 30);

    const documents = await db.collection('documents')
      .where('expiryDate', '>=', '2000-01-01')
      .where('expiryDate', '<=', formatDateKey(upcomingLimit))
      .get();

    if (documents.empty) return;

    const users = await db.collection('users').get();
    const usersByEmail = new Map();
    const admins = [];

    users.forEach((snapshot) => {
      const data = snapshot.data();
      const entry = { uid: snapshot.id, ...data };
      if (data.email) usersByEmail.set(data.email.toLowerCase(), entry);
      if (data.role === 'admin') admins.push(entry);
    });

    for (const snapshot of documents.docs) {
      const documentData = snapshot.data();
      const expiration = new Date(`${documentData.expiryDate}T00:00:00`);
      const days = Math.ceil((expiration - today) / 86400000);
      const state = days < 0 ? 'expired' : 'soon';
      const severity = state === 'expired' ? 'danger' : 'warning';
      const employeeUser = usersByEmail.get((documentData.ownerEmail || '').toLowerCase());
      const recipients = [
        ...(employeeUser ? [{ ...employeeUser, recipientRole: 'employee', link: '/expediente' }] : []),
        ...admins.map((adminUser) => ({
          ...adminUser,
          recipientRole: 'admin',
          link: `/expedientes/${documentData.employeeId}`,
        })),
      ];

      for (const recipient of recipients) {
        const alertId = safeId(`${snapshot.id}_${recipient.uid}_${state}`);
        const notificationRef = db.collection('notifications').doc(alertId);
        if ((await notificationRef.get()).exists) continue;

        const title = state === 'expired'
          ? `Documento vencido: ${documentData.category}`
          : `Documento próximo a vencer: ${documentData.category}`;
        const message = state === 'expired'
          ? `${documentData.employeeName}: ${documentData.fileName} venció el ${formatDisplayDate(expiration)}.`
          : `${documentData.employeeName}: ${documentData.fileName} vence ${days === 0 ? 'hoy' : `en ${days} días`}.`;

        await notificationRef.set({
          recipientUid: recipient.uid,
          recipientEmail: recipient.email,
          recipientRole: recipient.recipientRole,
          employeeId: documentData.employeeId,
          documentId: snapshot.id,
          title,
          message,
          severity,
          link: recipient.link,
          read: false,
          createdAt: FieldValue.serverTimestamp(),
        });

        await db.collection('mail').doc(alertId).set({
          to: recipient.email,
          message: {
            subject: `[Mossaspa] ${title}`,
            html: `<p>${escapeHtml(message)}</p><p>Ingresa a RRHH Mossaspa para revisar el expediente.</p>`,
          },
        });

        const devices = await db.collection('users').doc(recipient.uid).collection('devices').get();
        const tokens = devices.docs.map((device) => device.data().token).filter(Boolean);
        if (tokens.length) {
          await admin.messaging().sendEachForMulticast({
            tokens,
            notification: { title, body: message },
            webpush: { fcmOptions: { link: recipient.link } },
            data: { link: recipient.link, documentId: snapshot.id },
          });
        }
      }
    }
  }
);

function formatDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function formatDisplayDate(date) {
  return new Intl.DateTimeFormat('es-CL').format(date);
}

function safeId(value) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function assertAdmin(auth) {
  if (!auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  const profile = await db.collection('users').doc(auth.uid).get();
  if (!profile.exists || profile.data().role !== 'admin') {
    throw new HttpsError('permission-denied', 'Solo un administrador puede usar el terminal de marcaje.');
  }
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
  const [hour, minute] = String(scheduleStart).split(':').map(Number);
  const currentParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Santiago',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const currentHour = Number(currentParts.find((part) => part.type === 'hour')?.value || 0);
  const currentMinute = Number(currentParts.find((part) => part.type === 'minute')?.value || 0);
  return currentHour * 60 + currentMinute > hour * 60 + minute;
}
