# Plan: Mock Agent de Lead Gen (demo de funcionalidad)

**Objetivo:** Mostrar la funcionalidad de lead generation y outreach dentro de la plataforma Agent Warmup: flujo completo mock (búsqueda de leads → creación de runs → agente de outreach → revisión), visible y usable desde el SaaS. Sin integración real con Clay en este MVP.

**Decisión actual:** **Mock completo de todo.** Rowan indica que es sobre todo para mostrar funcionalidad. No se usa Clay ni APIs externas; todo el flujo se simula en el frontend/backend con datos de ejemplo.

**Target de negocio (simulado):** Grandes marcas CPG o D2C con call centers grandes que exploran agentes de IA en contact center — representado por un dataset mock fijo.

---

## 0. Búsqueda intensiva del SaaS — hallazgos

### Estructura actual

- **Layout:** Sidebar fija (240px) con Navigation + System Status + System Info; Header con búsqueda, indicadores (Events, Connections, Uptime), hora, org, usuario. Contenido en `<main className="p-4 lg:p-6">`.
- **Rutas:** `/dashboard` (Overview), `/dashboard/events`, `/dashboard/runs`, `/dashboard/connections`, `/dashboard/docs`, `/dashboard/settings`. Cada sección tiene una página con header (label uppercase + h1) y uno o más **panels** (`panel`, `panel__header`, `panel__content`).
- **Overview:** "Operational Overview"; 4 cards de métricas (Events Today, Connections, Runs, System Health); panel "Getting Started" (3 pasos: Connect → Events → Replay) con links a Connections/Events/Runs; columna derecha: Recent Runs ("View all" → Runs), Documentation, Support; Recent Activity al final.
- **Runs:** Título "Agent runs"; en el header **dos acciones** ("Send pending to agent", "Create test run"); filtro por **status** (All, Pending, Needs review, Completed, Rejected, Approved); lista de runs con link a detalle. **La API GET /api/runs ya acepta `workflowId`** en query; el cliente actual (`runs-client.tsx`) solo usa `status` y no lee `workflowId` de la URL.
- **Events:** Vista list/timeline con pestañas; streams y grabación; cliente complejo con estado propio.
- **Connections:** Lista de conexiones, modales para añadir fuentes; categorías y búsqueda.
- **Settings:** Secciones en panels (Profile, Organization, API Configuration, **Agent Endpoint**, System Status, Danger Zone). Agent Endpoint es donde se configura la URL del agente (usado por process-pending).

### Patrones de UX observados

- **Acciones principales** van en la fila del título (ej. Runs: "Send pending to agent", "Create test run") con `btn btn--primary` / `btn btn--secondary`.
- **Panels:** título en `panel__header` a veces con badge o link ("View all"); contenido en `panel__content` o listas con `divide-y divide-border-dim`.
- **Navegación entre flujos:** links explícitos (Recent Runs → "View all" → `/dashboard/runs`). No hay tabs por tipo de workflow en una sola página; cada flujo tiene su ruta.
- **Empty states:** mensaje + CTA (ej. Runs: "No runs yet" + "Create test run").
- **Filtros:** en Runs son botones en un bar bajo el header del panel (status); no hay filtro por `workflowId` en la UI aunque la API lo soporta.

### Conclusión para Lead gen

- Encajar con el mismo patrón: **página dedicada** con header + acciones en la barra superior + panels (resultados, avisos). No mezclar con Events ni Connections.
- **Runs** es donde se revisan y procesan todos los runs; para lead-gen tiene sentido poder **filtrar por workflowId=lead-gen** desde la URL y/o desde un filtro en Runs.
- **Overview** es el "hub"; dar visibilidad a Lead gen ahí (panel o card con acceso rápido) mejora descubrimiento sin sobrecargar.

---

## 0.1 Estrategia de UX recomendada y panel de control óptimo

### Estrategia (híbrido)

1. **Panel principal del flujo Lead gen:** una **página dedicada** `/dashboard/lead-gen` (entrada en sidebar "Lead gen"). Ahí vive todo el flujo: Run search → tabla de leads → Create runs → enlace a "Ver y procesar runs". Este es el **panel de control óptimo** para la funcionalidad: un solo lugar donde se ejecuta el demo de punta a punta.
2. **Descubrimiento desde Overview:** en la página **Overview** (`/dashboard`) añadir un **panel o card "Lead gen (demo)"**: descripción en una línea, botón "Open Lead gen" que lleva a `/dashboard/lead-gen`. Opcional: mostrar "X runs" de lead-gen (llamando a `/api/runs?workflowId=lead-gen&limit=5` o usando stats) para que se vea actividad reciente.
3. **Revisión y process en Runs:** los runs creados desde Lead gen tienen `workflowId: "lead-gen"`. Para no mezclar con otros runs y dar la mejor UX:
   - En la página **Runs**, añadir filtro por **Workflow** (junto al de status): opciones "All", "Lead gen", "Demo workflow" (y otros si existen). Al elegir "Lead gen", la URL debe ser `/dashboard/runs?workflowId=lead-gen` y la lista solo muestra esos runs.
   - Los enlaces desde Lead gen a "Ver runs creados" deben apuntar a `/dashboard/runs?workflowId=lead-gen`. Así el usuario va de Lead gen (crear) → Runs filtrado (revisar y "Send pending to agent") sin pasos de más.

### ¿Cuál es el panel de control más óptimo?

- **Para ejecutar el demo de lead gen:** el **panel óptimo es la página Lead gen** (`/dashboard/lead-gen`). Concentra: búsqueda mock, tabla, creación de runs y el CTA a revisar en Runs. Un solo lugar, flujo lineal.
- **Para revisar y procesar los runs de lead gen:** el **panel óptimo es Runs con filtro workflowId=lead-gen** (ruta `/dashboard/runs?workflowId=lead-gen`). Ahí está "Send pending to agent" y el detalle de cada run; no hace falta un segundo "control panel" solo para lead-gen.
- **Para que el usuario encuentre la función:** el **Overview** actúa como índice; el pequeño panel "Lead gen (demo)" con enlace a `/dashboard/lead-gen` es el punto de entrada recomendado además del sidebar.

Resumen: **panel de control principal = página Lead gen**; **panel de revisión = Runs (con filtro por workflow)**; **punto de entrada adicional = Overview**.

---

## 1. Resumen (Rowan ↔ Ernesto)

- Rowan necesita un mock agent para probar operaciones de outreach; usa Clay como fuente de leads en su día a día.
- Se acordó un agente enfocado en lead gen (CPG/D2C + call center + AI). Para este MVP se va con **mock completo** para demostrar la funcionalidad en el SaaS, sin depender de Clay ni de APIs externas.

---

## 2. Alcance técnico (mock completo)

- **Búsqueda de "leads":** Endpoint que devuelve siempre una lista mock (dataset fijo en código/JSON). Sin llamadas a Clay ni a ningún servicio externo.
- **Creación de runs:** Por cada lead mock se crea un Run con `eventSnapshot` = lead, `workflowId` = `"lead-gen"`, `mode` = `"shadow"`.
- **Agente de outreach:** Endpoint mock que recibe la invocación y devuelve drafts (email, subject, body, etc.). El tenant de prueba debe tener el Agent Endpoint apuntando a este mock.
- **Process pending:** Se usa el flujo existente (`POST /api/runs/process-pending`); los runs pasan a `pending_review` con la respuesta del mock agent.
- **Sin:** variables de entorno Clay, webhooks hacia Clay, ni integración con Events Manager para este flujo (los runs se crean directo en el Run Store).

---

## 3. Dónde vive en el stack

Todo en **agent-warmup-saas** (Next.js):

- **API routes:** `app/api/lead-gen/clay-search/route.ts`, `app/api/lead-gen/create-runs/route.ts`, `app/api/mock-agent/outreach/route.ts`.
- **Dataset mock:** Constante o JSON en el repo (p. ej. `lib/lead-gen-mock-data.ts` o `data/lead-gen-mock.json`) con 10–20 empresas ejemplo (nombre, dominio, industria, call_center_size, ai_agents_exploration).
- **Run Store y process-pending:** Los mismos que ya existen; solo se asegura que el Agent Endpoint del tenant apunte al mock de outreach para runs con `workflowId === "lead-gen"`.

---

## 4. Interfaz en el SaaS — dónde y qué

### 4.1 Dónde colocar "Lead gen" en el SaaS

La navegación actual del dashboard es (sidebar): **Overview**, **Events**, **Runs**, **Connections**, **Documentation**, **Settings**.

- **Recomendación:** Añadir una entrada propia **"Lead gen"** en el sidebar, entre **Runs** y **Connections**.
- **Ruta:** `/dashboard/lead-gen`.
- **Motivo:** Lead gen es un flujo distinto (generar leads mock → crear runs → procesar con agente de outreach). Tener una sección dedicada hace el flujo visible y evita mezclarlo con Events/Connections. Los runs creados seguirán apareciendo en **Runs** (filtrando por `workflowId` o viendo todos), con enlace claro desde Lead gen a "Ver runs creados".

**Archivos a tocar para la ubicación:**

- **Sidebar:** `apps/frontend/components/layout/sidebar.tsx` — añadir un ítem en el array `navigation` con `name: "Lead gen"`, `href: "/dashboard/lead-gen"`, y un icono acorde (p. ej. usuarios/empresas o target).
- **Nueva página:** `apps/frontend/app/(dashboard)/dashboard/lead-gen/page.tsx` (server) y un cliente para la lógica/estado, p. ej. `lead-gen-client.tsx`, o todo en un client component en la page.

### 4.2 Contenido de la página Lead gen

La página debe permitir **ver la funcionalidad** de punta a punta sin salir del SaaS:

1. **Título y descripción breve**  
   Ej.: "Lead gen (demo)" — Simula una búsqueda de empresas CPG/D2C con call centers que exploran IA. Los resultados son datos de ejemplo; puedes crear runs y procesarlos con el agente de outreach.

2. **Acción: "Run search" (o "Load demo leads")**  
   Botón que llama a `GET` o `POST /api/lead-gen/clay-search` y muestra la lista mock en una tabla (columnas sugeridas: nombre, dominio, industria, call center size, AI exploration).

3. **Tabla de resultados**  
   Tras el search, mostrar las filas con los campos anteriores. Opcional: checkbox para seleccionar un subconjunto (por defecto "todos").

4. **Acción: "Create runs from these leads"**  
   Botón que envía la lista mostrada (o la selección) a `POST /api/lead-gen/create-runs`. Mostrar feedback: "X runs created" y, si hay error, mensaje claro.

5. **Siguiente paso**  
   Texto + enlace a **Runs filtrado por lead-gen:** "Process these runs with the outreach agent" → enlace a `/dashboard/runs?workflowId=lead-gen`. Opcional: botón "Process pending" en la misma página Lead gen que llame a `POST /api/runs/process-pending` (como en Runs) para no obligar a cambiar de página. La página Runs debe **soportar `workflowId` en la URL** y mostrar un filtro por Workflow (All | Lead gen | Demo workflow) para que ese enlace sea útil.

6. **Requisito para el agente**  
   Aviso corto en la página: "Para que los runs se procesen con drafts de outreach, configura en Settings → Agent endpoint la URL del mock agent (…)" o similar, con la URL del mock (ej. la ruta absoluta a `POST /api/mock-agent/outreach` en su entorno).

Diseño: reutilizar los mismos patrones del resto del dashboard (paneles `panel`, `panel__header`, `panel__content`, botones `btn`, tabla simple) para consistencia visual.

---

## 5. Plan de implementación (orden sugerido)

### Fase 1: Backend mock (sin UI)

1. **Dataset mock:** Crear `lib/lead-gen-mock-data.ts` (o JSON + import) con 10–20 empresas (nombre, dominio, industria, call_center_size, ai_agents_exploration, id estable para idempotencia).
2. **GET o POST `/api/lead-gen/clay-search`:** Devuelve siempre el array mock. Sin params obligatorios (opcional: query param para "limit").
3. **POST `/api/lead-gen/create-runs`:** Body: `{ leads: Lead[] }` (el mismo shape que devuelve clay-search). Por cada lead, crear run vía lógica equivalente a `POST /api/runs` (eventId ULID, invocationId `lead_gen_${lead.id}`, eventSnapshot = lead, workflowId `"lead-gen"`, mode `"shadow"`). Requiere auth y tenantId.
4. **POST `/api/mock-agent/outreach`:** Recibe el payload estándar de invocación (tenant_id, workflow_id, event, event_id, invocation_id, run_id, mode). Responde con JSON fijo: `{ drafts: [{ channel: "email", subject: "...", body: "..." }], proposed_actions: [], questions_for_humans: [], metadata: { confidence: 0.9 } }`. Opcional: variar ligeramente el body según `event` (p. ej. incluir nombre de la empresa del lead en el draft).

### Fase 2: Ubicación y estructura de la UI

5. **Sidebar:** En `components/layout/sidebar.tsx`, añadir entrada "Lead gen" con `href: "/dashboard/lead-gen"` e icono (p. ej. Users o BuildingOffice).
6. **Ruta y página:** Crear `app/(dashboard)/dashboard/lead-gen/page.tsx` que renderice el cliente de Lead gen (o el contenido inline). Protegida por auth como el resto del dashboard.
7. **Runs: filtro por workflow:** En `app/(dashboard)/dashboard/runs/runs-client.tsx`: leer `workflowId` de `useSearchParams()` (o de la URL); pasar `workflowId` a `buildRunsUrl(status, cursor, limit, workflowId)` y usarlo en la petición a `/api/runs`. Añadir en la barra de filtros (junto a status) un filtro "Workflow": All | Lead gen | Demo workflow; al elegir uno, actualizar la URL con `?workflowId=lead-gen` (o el que corresponda) para que "Ver runs creados" desde Lead gen abra Runs ya filtrado.
8. **Overview: panel Lead gen (demo):** En `dashboard-content.tsx`, en la columna derecha (donde están Recent Runs, Documentation, Support), añadir un **panel "Lead gen (demo)"**: título, una línea de descripción, botón "Open Lead gen" → Link a `/dashboard/lead-gen`. Opcional: mostrar número de runs lead-gen (fetch a `/api/runs?workflowId=lead-gen&limit=1` o incluir en `useDashboardStats` un `leadGenRunsCount`) con enlace "X runs" → `/dashboard/runs?workflowId=lead-gen`.

### Fase 3: Contenido de la página Lead gen

9. **Cliente de la página:** Componente con estado (resultados del search, loading, mensaje post create-runs). Botón "Run search" → fetch a `/api/lead-gen/clay-search` → guardar resultado y mostrar tabla. Botón "Create runs from these leads" → POST a `/api/lead-gen/create-runs` con la lista actual → mostrar éxito/error. Enlace a "Ver runs creados" → `/dashboard/runs?workflowId=lead-gen`. Opcional: botón "Process pending" en la misma página.
10. **Tabla:** Mostrar columnas nombre, dominio, industria, call_center_size, ai_agents_exploration. Sin paginación si son ~20 filas.
11. **Aviso de configuración:** Texto que indique configurar el Agent Endpoint en Settings con la URL del mock agent para poder procesar los runs.

### Fase 4: Comprobación end-to-end

12. **Configuración en Settings:** En el tenant de prueba, poner en Agent endpoint la URL absoluta de `POST /api/mock-agent/outreach` (ej. `https://<tu-dominio>/api/mock-agent/outreach`).
13. **Flujo:** Lead gen → Run search → Create runs → "Ver runs creados" (Runs con workflowId=lead-gen) → "Send pending to agent" → Ver runs en `pending_review` con drafts del mock agent.

---

## 6. Checklist de entrega

**Backend**
- [ ] Dataset mock y endpoint `GET/POST /api/lead-gen/clay-search` que devuelve esa lista.
- [ ] Endpoint `POST /api/lead-gen/create-runs` que crea runs con `workflowId: "lead-gen"` y `eventSnapshot` = lead.
- [ ] Endpoint `POST /api/mock-agent/outreach` que responde con drafts/outreach.

**UI — panel principal (Lead gen)**
- [ ] Entrada "Lead gen" en el sidebar apuntando a `/dashboard/lead-gen`.
- [ ] Página `/dashboard/lead-gen` con: título/descripción, botón Run search, tabla de resultados, botón Create runs, feedback de éxito/error, enlace "Ver runs creados" → `/dashboard/runs?workflowId=lead-gen`.
- [ ] Aviso en la página para configurar el Agent Endpoint con la URL del mock.

**UI — descubrimiento y revisión (mejor UX)**
- [ ] En **Overview:** panel o card "Lead gen (demo)" con descripción y botón "Open Lead gen" → `/dashboard/lead-gen`.
- [ ] En **Runs:** filtro por Workflow (All | Lead gen | Demo workflow); URL con `workflowId` y cliente que use ese param en las peticiones a `/api/runs`.

**E2E**
- [ ] Flujo demostrable: Overview o Sidebar → Lead gen → Run search → Create runs → Ver runs (filtro Lead gen) → Send pending to agent → Runs en `pending_review` con agentResponse.

---

## 7. Referencia rápida (Clay)

En este MVP no se integra con Clay. En el futuro, si se añade integración real (p. ej. Clay como fuente de leads), se podría mantener la misma UI y sustituir solo el origen de datos del "search" (llamada a Clay en lugar del mock). La documentación oficial de Clay (Find AI, webhooks, HTTP API) queda como referencia para esa fase posterior.
