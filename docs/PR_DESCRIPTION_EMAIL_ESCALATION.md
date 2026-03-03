# PR: Trace escalation via email (CHR-53)

## Resumen

Implementa el flujo de **Request Review por email** en el dashboard de Labeling: el usuario puede enviar una solicitud de revisión a un revisor por **Email** (además de Slack). El revisor recibe un correo con resumen del trace y enlaces para **View**, **Claim** y **Escalate**.

Sigue el patrón del monorepo: el **backend (Rust)** envía el correo (Resend), guarda el log de escalación y verifica los tokens de los enlaces; el **frontend** construye el HTML (React Email), genera los tokens firmados y hace proxy a las rutas del backend.

---

## Cambios principales

### Backend (Rust)

- **Interfaces**: `HtmlEmailParams` y método `send_html_email` en el trait `EmailService`.
- **Resend**: implementación de `send_html()` para enviar correos con HTML vía API de Resend.
- **Escalation log**: nuevo módulo `api/escalation.rs` con `EscalationEntry`, `EscalationLog`; integrado en `SaasAppState` y en los builders de estado (memory/postgres).
- **Rutas**:
  - `POST /api/platform/labeling/notify`: comprueba duplicados, registra en el log, envía HTML por Resend (o noop si no hay API key).
  - `GET /api/platform/email-actions/:token`: **pública**; verifica token HMAC, ejecuta view/claim/escalate y responde 302 al frontend.
- **Dependencia**: `base64` para decodificar tokens.

### Frontend (Next.js)

- **Lib**:
  - `notification-summary.ts`: `TraceSummaryForNotification`, `buildTraceSummaryForNotification`, helpers de formato.
  - `email-templates/trace-escalation.tsx`: componente React Email del correo (template literals para evitar comentarios en el HTML).
  - `email-actions.ts`: creación y verificación de tokens HMAC (view/claim/escalate, 48h).
  - `labeling/store.ts`: seed con `MOCK_TRACES`, método `claimTrace`.
  - `labeling/org.ts`: `getEscalationManagers()`.
- **Rutas API**:
  - `POST /api/labeling/notify`: obtiene sesión, resuelve revisor y trace, construye resumen, tokens y HTML, hace proxy a `POST /api/platform/labeling/notify`.
  - `GET /api/email-actions/[token]`: proxy al backend; devuelve el 302 para View/Claim/Escalate.
  - `POST /api/webhooks/resend`: stub 501 (webhooks futuros en backend).
- **Dependencias**: `@react-email/components`, `@react-email/render` (Resend/Svix eliminados; no se usan tras el refactor proxy).
- **backend.ts**: mensaje de error mejorado en token-exchange con indicación de `SERVICE_SECRET`.

### Documentación

- `GETTING_STARTED.md`: variables de entorno (RESEND, EMAIL_FROM, etc.) y responsabilidades frontend/backend.
- `app/api/labeling/README.md`: patrón proxy y rol de cada ruta.
- `docs/testing-email-escalation.md`: guía paso a paso para probar el flujo y errores frecuentes.

---

## Cómo probar

1. **Env**: mismo `SERVICE_SECRET` en frontend y backend; `ENCRYPTION_KEY` compartida; opcional `RESEND_API_KEY` y `RESEND_FROM_ADDRESS` (o `delivered@resend.dev` para pruebas).
2. Arrancar backend y frontend; iniciar sesión; ir a **Dashboard → Labeling**.
3. Abrir un trace y en "Request Review" elegir un revisor y pulsar **Email**.
4. Comprobar en Network que `POST /api/labeling/notify` devuelve 200.
5. Con Resend en modo test, el correo solo puede enviarse al email de la cuenta de Resend; los enlaces del correo apuntan a `/api/email-actions/<token>` (proxy al backend → redirect a la página del trace).

Guía detallada: `docs/testing-email-escalation.md`.

---

## Checklist

- [x] Backend envía correo HTML vía Resend (o noop sin API key).
- [x] Log de escalación en backend (in-memory; sin persistencia en DB aún).
- [x] Tokens de acción firmados con HMAC; expiración 48h en segundos (alineado frontend/backend).
- [x] Serde camelCase en `ActionPayload` para coincidir con el payload del frontend.
- [x] Rutas de labeling como proxy; sin lógica de negocio de envío en el frontend.
- [x] Documentación de env, patrón y testing.

---

## Relación

- Linear: **CHR-53** (Trace escalation via email)
- Diseño: Email-based trace escalation design doc (Linear)
