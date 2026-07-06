/* global firebase */
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js');

const params = new URL(self.location.href).searchParams;
firebase.initializeApp({
  apiKey: params.get('apiKey'),
  authDomain: params.get('authDomain'),
  projectId: params.get('projectId'),
  storageBucket: params.get('storageBucket'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
});

firebase.messaging().onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'RRHH Mossaspa';
  const options = {
    body: payload.notification?.body || 'Tienes una nueva alerta documental.',
    icon: '/icon.svg',
    data: { link: payload.data?.link || '/notificaciones' },
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.link || '/notificaciones'));
});
