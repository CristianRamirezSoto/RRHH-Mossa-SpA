# Marcaje facial local

El módulo utiliza `@vladmandic/human`, un motor de código abierto con licencia
MIT. La detección, prueba de vida, anti-suplantación y comparación facial se
ejecutan directamente en el celular o notebook.

No se utiliza un servicio biométrico de pago y los modelos están incluidos en
`public/models`, por lo que el terminal no necesita descargar modelos externos.

## Preparación de trabajadores

1. Crear o editar la ficha del trabajador.
2. Configurar su horario de entrada.
3. Registrar que existe consentimiento biométrico.
4. Abrir **Biometría**.
5. Seleccionar al trabajador y completar las cinco muestras guiadas.

Se guarda una plantilla matemática promedio en `biometricProfiles`. Las
fotografías y fotogramas utilizados durante el proceso no se guardan.

## Terminal público

Desde **Marcaje**, elegir **Abrir modo terminal** y crear un PIN temporal de
cuatro dígitos. El modo terminal:

- Oculta el menú administrativo.
- Puede utilizar pantalla completa.
- Exige el PIN para regresar al panel.
- Mantiene activa la cámara para marcaje automático.

El PIN solo vive durante la sesión del navegador y no se guarda en Firebase.

## Seguridad del marcaje

Antes de aceptar una marcación se exige:

- Trabajador activo.
- Consentimiento biométrico registrado.
- Plantilla facial enrolada.
- Similitud mínima de 62%.
- Prueba anti-fotografía.
- Prueba de vida.
- Desafío aleatorio: giro de cabeza o parpadeo.

El backend bloquea marcaciones repetidas dentro de 90 segundos y alterna
automáticamente entre entrada y salida.

## Privacidad

Las plantillas faciales son datos biométricos sensibles. Se debe mantener:

- Consentimiento escrito e informado.
- Acceso exclusivo de administradores autorizados.
- Política de conservación y eliminación.
- Procedimiento alternativo de marcaje para quien no pueda o no desee usar
  biometría.

El sistema reduce el uso de imágenes, pero no debe presentarse como invulnerable
frente a ataques sofisticados con máscaras o video de alta calidad.
