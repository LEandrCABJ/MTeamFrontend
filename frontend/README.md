# M-Team Frontend

Aplicación web de M-Team Gimnasio desarrollada con React, Vite y TypeScript.

## Configuración local

1. Copiar `.env.example` como `.env`.
2. Verificar que `VITE_API_URL` apunte al backend, por defecto `http://localhost:3000/api`.
3. Instalar dependencias con `npm.cmd install` en Windows PowerShell.
4. Iniciar la aplicación con `npm.cmd run dev`.

El archivo `.env` no debe versionarse. Las variables con prefijo `VITE_` son públicas en el navegador y nunca deben contener secretos.

El frontend se comunica exclusivamente con la API REST. No debe configurarse con
URLs de PostgreSQL, claves privadas de Supabase ni credenciales de Storage.

## Scripts

- `npm.cmd run dev`: inicia el entorno local.
- `npm.cmd run build`: valida TypeScript y genera la aplicación.
- `npm.cmd run lint`: ejecuta las reglas de calidad.
- `npm.cmd test`: ejecuta las pruebas automatizadas.
- `npm.cmd run test:e2e`: ejecuta los flujos de navegador con Playwright. En Windows usa Microsoft Edge; en otros sistemas necesita Chromium instalado con `npx playwright install chromium`.

Las pruebas E2E de autenticación, acreditación de pagos, consulta de eventos y lectura de notificaciones simulan las respuestas de la API y bloquean cualquier otra llamada de red. La prueba de acceso QR también simula el permiso de cámara denegado. No necesitan cuentas reales, el backend ni Supabase, y no modifican datos. Validan recorridos de la interfaz; la integración real con PostgreSQL/Supabase se ejecuta por separado desde el backend.

## Módulo de autenticación

El módulo implementa registro, inicio y cierre de sesión, persistencia opcional de la sesión, cambio obligatorio de contraseña temporal y protección de rutas. La comunicación HTTP está centralizada en `src/service/api-client.ts` y utiliza la estructura de errores definida por el backend: `code`, `message` y `details`.

Rutas disponibles:

- `/crear-cuenta`
- `/iniciar-sesion`
- `/cambiar-contrasena`
- `/inicio` (redirige al inicio protegido según el rol)

## Integración disponible

La integración usa las rutas efectivamente implementadas en el backend para:

- autenticación, cierre de sesión y consulta de identidad;
- perfil propio;
- usuarios administrativos y socios;
- valor e historial de la cuota;
- acreditación, consulta y anulación de pagos;
- sedes públicas y administración de sedes;
- directorio público de entrenadores;
- cronograma semanal, copia de semanas y administración de clases;
- carga, consulta, revisión y acceso temporal a certificados médicos;
- escaneo real de cámara para socios y entrenadores y envío del token QR fijo a
  `POST /access-attempts`, con visualización del resultado devuelto por la API.

Los dashboards consumen las métricas disponibles y mantienen estados de carga,
error o no disponibilidad cuando falta información agregada. Los módulos de
eventos, novedades, notificaciones, historial de accesos y período
inicial del panel administrativo se muestran como pendientes porque sus APIs
todavía no forman parte del alcance de integración acordado. No se usan datos
simulados como reemplazo cuando falta un endpoint o el backend no está disponible.
