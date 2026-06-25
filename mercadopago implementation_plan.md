# Integración del Sistema de Suscripciones (Mercado Pago, Pruebas y Renovaciones)

Este plan detalla los pasos para incorporar el sistema completo de suscripción mediante **Mercado Pago**, el período de prueba de 30 días, las renovaciones anticipadas y las mejoras UX/UI del login y perfil desde la versión de referencia (V1) hacia esta versión (V2).

## User Review Required

> [!IMPORTANT]
> **Esquema de Base de Datos (Supabase)**: Se requiere verificar si las tablas `pending_registrations` y `app_config`, así como las columnas adicionales en `profiles`, ya existen en Supabase (compartido con V1) o si es necesario ejecutarlos.

## Proposed Changes

---

### Backend (`server.ts`)

#### [MODIFY] [server.ts](file:///c:/Users/Ariel/Downloads/personal-flight-log/server.ts)
- Agregar imports de SDK de Mercado Pago (`MercadoPagoConfig`, `PreApprovalPlan`, `PreApproval`).
- Inicializar `mpClient` utilizando la variable de entorno `MP_ACCESS_TOKEN`.
- Agregar los siguientes endpoints:
  - `POST /api/mercadopago/register-with-trial` (Registro con trial directo)
  - `POST /api/mercadopago/create-subscription` (Generación de Checkout URL de MP)
  - `POST /api/mercadopago/webhook` (Recepción asíncrona de cobros/suscripciones)
  - `POST /api/mercadopago/cancel-subscription` (Cancelación de suscripción)
  - `GET /api/mercadopago/subscription-callback` (Lógica de callback post-pago con tolerancia de URL malformada)
- Agregar helper `getOrCreateAnnualPlan` para leer el monto actual dinámicamente desde `app_config`.

#### [MODIFY] [package.json](file:///c:/Users/Ariel/Downloads/personal-flight-log/package.json)
- Añadir `"mercadopago": "^3.1.0"` a las dependencias.

---

### Frontend Components

#### [MODIFY] [AuthScreen.tsx](file:///c:/Users/Ariel/Downloads/personal-flight-log/src/components/AuthScreen.tsx)
- Reemplazar el registro directo de Supabase Auth por llamadas al backend (`create-subscription` para pago o `register-with-trial` si se prefiere comenzar en período de prueba).
- Implementar el centrado vertical del formulario en la pantalla aplicando `flex-1` en el contenedor raíz y `-mt-8` en el `motion.div`.

#### [MODIFY] [App.tsx](file:///c:/Users/Ariel/Downloads/personal-flight-log/src/App.tsx)
- Incorporar la pantalla `SubscriptionExpiredScreen` para manejar accesos de cuentas trial vencidas o pagos cancelados/expirados.
- Gestionar los query parameters `?payment=success` o `?payment=error` para mostrar modales de confirmación con estética premium en lugar de `alert()` nativos.
- Ajustar el wrapper de `AuthScreen` para posibilitar el centrado vertical correcto.

#### [MODIFY] [HomeScreen.tsx](file:///c:/Users/Ariel/Downloads/personal-flight-log/src/components/HomeScreen.tsx)
- Mostrar el estado del plan actual (Trial vs Activo) en la tarjeta informativa con colores adecuados (verde/ámbar).
- Hacer que la card de suscripción sea interactiva y redirija automáticamente al perfil en la sección correspondiente.

#### [MODIFY] [LibroScreen.tsx](file:///c:/Users/Ariel/Downloads/personal-flight-log/src/components/LibroScreen.tsx)
- Añadir el botón "Renovar Suscripción" (visible cuando faltan 30 días o menos).
- Eliminar el botón "Cancelar Suscripción" en favor de la renovación manual.
- Añadir scroll automático hacia la sección de suscripción (`#subscription-card`) si la flag correspondiente existe en el `localStorage`.
- Implementar el modal de confirmación premium de Mercado Pago antes de iniciar el checkout.

## Verification Plan

### Automated Tests
- Ejecutar `npm run dev` y comprobar que no hay errores de sintaxis o empaquetado en el servidor backend ni en el cliente Vite.
- Probar endpoint `POST /api/mercadopago/register-with-trial` usando una herramienta de peticiones (ej. `Invoke-WebRequest` o script de test).

### Manual Verification
1. Registrar un nuevo usuario de prueba y validar que se inicie sesión con 30 días de prueba gratuita.
2. Simular un checkout redirigiendo al initPoint de Mercado Pago.
3. Verificar que al regresar del flujo de pago, el callback redireccione correctamente al dashboard con el banner de éxito.
