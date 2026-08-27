import {
  BarChart,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Grid,
  H1,
  H2,
  H3,
  Pill,
  Row,
  Stack,
  Stat,
  Table,
  Text,
  TodoList,
  useCanvasState,
} from "cursor/canvas";

type TabId = "resumen" | "api" | "deps" | "auth" | "uploads" | "perf" | "ux";

const TABS: { id: TabId; label: string }[] = [
  { id: "resumen", label: "Resumen" },
  { id: "api", label: "API / vulns" },
  { id: "deps", label: "Dependencias" },
  { id: "auth", label: "Auth / RBAC" },
  { id: "uploads", label: "Uploads" },
  { id: "perf", label: "Rendimiento" },
  { id: "ux", label: "UX / UI" },
];

const SEVERITY_COUNTS = [
  { label: "Crítico", value: 1 },
  { label: "Alto", value: 4 },
  { label: "Medio", value: 12 },
  { label: "Bajo", value: 4 },
];

export default function AuditoriaSigafCanvas() {
  const [tab, setTab] = useCanvasState<TabId>("tab", "resumen");

  return (
    <Stack gap={20} style={{ padding: 20, maxWidth: 1100 }}>
      <Stack gap={6}>
        <H1>Auditoría SIGAF</H1>
        <Text tone="secondary" size="small">
          Revisión estática · npm audit · código local · Ago 2026 · No sustituye
          pentest externo ni SonarQube/Snyk en CI
        </Text>
      </Stack>

      <Row gap={8} wrap>
        {TABS.map((t) => (
          <Pill key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </Pill>
        ))}
      </Row>

      {tab === "resumen" && <Resumen />}
      {tab === "api" && <ApiTab />}
      {tab === "deps" && <DepsTab />}
      {tab === "auth" && <AuthTab />}
      {tab === "uploads" && <UploadsTab />}
      {tab === "perf" && <PerfTab />}
      {tab === "ux" && <UxTab />}
    </Stack>
  );
}

function Resumen() {
  return (
    <Stack gap={16}>
      <Grid columns={4} gap={12}>
        <Stat value="1" label="Críticos" tone="danger" />
        <Stat value="4" label="Altos" tone="warning" />
        <Stat value="9" label="npm audit" tone="warning" />
        <Stat value="Go" label="Veredicto LAN" tone="success" />
      </Grid>

      <Callout tone="danger" title="Hallazgo crítico">
        Respuestas JSON de usuarios/documentos pueden filtrar passwordHash y
        mfaSecret (include Prisma sin omit/select).
      </Callout>

      <Card>
        <CardHeader>Hallazgos de seguridad por severidad</CardHeader>
        <CardBody>
          <BarChart
            categories={SEVERITY_COUNTS.map((s) => s.label)}
            series={[
              { name: "Hallazgos", data: SEVERITY_COUNTS.map((s) => s.value) },
            ]}
            height={180}
          />
          <Text size="small" tone="secondary">
            Fuente: revisión estática del repo · no incluye pentest externo
          </Text>
        </CardBody>
      </Card>

      <H2>Prioridad de remediación</H2>
      <TodoList
        todos={[
          {
            id: "1",
            content:
              "Omitir passwordHash/mfaSecret en listUsers, createUser, getDocument, workflow",
            status: "pending",
          },
          {
            id: "2",
            content:
              "assertAllowedUpload + magic bytes en digitize e instruments",
            status: "pending",
          },
          {
            id: "3",
            content:
              "Bloquear asignación de roles con accessLevel ≥ al del actor",
            status: "pending",
          },
          {
            id: "4",
            content:
              "Validar dependencyId/locationId siempre con organizationId",
            status: "pending",
          },
          {
            id: "5",
            content:
              "Paginar documentos/TRD/archivo físico; adelgazar dashboard",
            status: "pending",
          },
          {
            id: "6",
            content: "npm audit: next/postcss/sharp (plan upgrade controlado)",
            status: "pending",
          },
        ]}
      />

      <Text size="small" tone="secondary">
        Snyk CLI y SonarQube no están instalados en este entorno (Java/SONAR
        ausentes). Recomendado en CI: snyk test + sonar-scanner.
      </Text>
    </Stack>
  );
}

function ApiTab() {
  return (
    <Stack gap={16}>
      <H2>Rutas API — superficie</H2>
      <Callout tone="info">
        Sin SQL Injection por concatenación (Prisma + un $queryRaw
        parametrizado). Sin SSRF a URLs de usuario. CSRF: Origin/Referer +
        SameSite=Lax (token CSRF definido pero no usado).
      </Callout>

      <Table
        headers={["Vector", "Estado", "Detalle"]}
        rows={[
          ["SQL Injection", "OK", "Prisma ORM; raw SQL con Prisma.sql"],
          ["SSRF", "OK", "fetch solo a rutas relativas propias"],
          ["CSRF", "Parcial", "Origin/Referer; CSRF_COOKIE no cableado"],
          ["XSS stored", "Bajo", "JSON encoding; CSP con unsafe-inline/eval"],
          ["IDOR org", "Riesgo", "FKs dependency/location sin check org en create"],
          ["Mass assign", "Parcial", "doc status bloqueado; settings value:unknown"],
          ["Path traversal", "OK", "resolveUploadPath rechaza .."],
        ]}
        rowTone={[
          "success",
          "success",
          "warning",
          "neutral",
          "warning",
          "warning",
          "success",
        ]}
      />

      <H3>Rutas débiles (solo sesión o sin permiso granular)</H3>
      <Table
        headers={["Ruta", "Gap", "Remedio"]}
        rows={[
          ["/api/v1/search", "Solo login", "requirePermission documents.read"],
          ["/api/v1/trd GET", "Sin permiso API", "instruments.read"],
          [
            "/api/v1/lifecycle/.../inventory",
            "Solo sesión",
            "transfers.read en ruta",
          ],
          [
            "/api/v1/users/.../status|reset",
            "Solo isAdminRole",
            "users.update / users.create",
          ],
        ]}
      />

      <H3>Hallazgos críticos y altos</H3>
      <Table
        headers={["Sev", "Hallazgo", "Dónde", "Remedio"]}
        rows={[
          [
            "CRÍTICO",
            "passwordHash / mfaSecret en JSON",
            "identity-service listUsers/createUser; documents include User",
            "omit o select explícito",
          ],
          [
            "ALTO",
            "Digitize sin upload-policy",
            "documents/[id]/digitize",
            "assertAllowedUpload + magic",
          ],
          [
            "ALTO",
            "Instruments upload sin política",
            "instruments/route + service",
            "Misma política attachments",
          ],
          [
            "ALTO",
            "Escalada por roleId",
            "createUser / updateUserRole",
            "accessLevel del actor",
          ],
          [
            "ALTO",
            "dependencyId cross-org",
            "canAccessDependency + createDocument",
            "findFirst id+organizationId",
          ],
        ]}
        rowTone={["danger", "warning", "warning", "warning", "warning"]}
      />
    </Stack>
  );
}

function DepsTab() {
  return (
    <Stack gap={16}>
      <H2>Análisis de dependencias</H2>
      <Grid columns={3} gap={12}>
        <Stat value="9" label="npm audit total" tone="warning" />
        <Stat value="6" label="High" tone="danger" />
        <Stat value="3" label="Moderate" tone="warning" />
      </Grid>

      <Table
        headers={["Severidad", "Paquete", "Nota", "Acción"]}
        rows={[
          [
            "high",
            "next → postcss",
            "XSS / path traversal en postcss vía Next 15.5",
            "Plan upgrade Next (breaking a 16)",
          ],
          [
            "high",
            "sharp",
            "CVEs libvips heredados",
            "Upgrade vía Next o sharp pin",
          ],
          [
            "high",
            "nodemailer",
            "SMTP command injection envelope.size",
            "Actualizar nodemailer",
          ],
          [
            "high",
            "js-yaml",
            "DoS !!omap (transitive)",
            "npm audit / overrides",
          ],
          [
            "high",
            "nanoid",
            "loop si size=0 (transitive)",
            "Actualizar cadena",
          ],
          [
            "moderate",
            "exceljs → uuid",
            "bounds check uuid",
            "Cuidado: audit --force baja exceljs",
          ],
          [
            "moderate",
            "dompurify",
            "XSS hook IN_PLACE (si se usa)",
            "Actualizar o verificar uso",
          ],
        ]}
        rowTone={[
          "danger",
          "danger",
          "danger",
          "danger",
          "danger",
          "warning",
          "warning",
        ]}
      />

      <Callout tone="warning">
        Snyk CLI: no instalado. SonarQube: JAVA_HOME ausente, sin
        sonar-project.properties. Recomendación CI: snyk test --severity=high y
        sonar-scanner en PR.
      </Callout>

      <Text size="small" tone="secondary">
        No ejecutar npm audit fix --force a ciegas: propone next@16 y
        exceljs@3.x (breaking).
      </Text>
    </Stack>
  );
}

function AuthTab() {
  return (
    <Stack gap={16}>
      <H2>Autenticación, autorización y roles</H2>
      <Grid columns={2} gap={12}>
        <Card>
          <CardHeader>Controles OK</CardHeader>
          <CardBody>
            <Stack gap={6}>
              <Text size="small">JWT + sessionId obligatorio en BD</Text>
              <Text size="small">Revocación logout / block / reset pwd</Text>
              <Text size="small">Cookie httpOnly + SameSite=Lax</Text>
              <Text size="small">requirePermission en la mayoría de /api/v1</Text>
              <Text size="small">requirePageAccess en páginas admin</Text>
              <Text size="small">MFA TOTP opcional</Text>
            </Stack>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>Gaps</CardHeader>
          <CardBody>
            <Stack gap={6}>
              <Text size="small">
                Permisos en JWT quedan stale hasta re-login
              </Text>
              <Text size="small">
                Middleware no valida sesión BD (solo firma)
              </Text>
              <Text size="small">DOC_ADMIN puede asignar SUPER_ADMIN</Text>
              <Text size="small">
                Bypass middleware en paths con punto (includes ".")
              </Text>
              <Text size="small">search / trd GET sin permiso granular</Text>
              <Text size="small">Rate limit in-memory + X-Forwarded-For</Text>
            </Stack>
          </CardBody>
        </Card>
      </Grid>

      <Table
        headers={["Rol", "Riesgo observado", "Acción"]}
        rows={[
          [
            "SUPER_ADMIN",
            "Bypass total de permisos (by design)",
            "Auditar uso; MFA obligatorio en prod",
          ],
          [
            "DOC_ADMIN",
            "Puede elevar roleId a SUPER",
            "Comparar accessLevel",
          ],
          [
            "CONSULT_USER",
            "Tras fix: módulos acotados",
            "Re-login tras cambio de permisos",
          ],
          [
            "DEPT_*",
            "Scope por dependencia en docs",
            "Mantener documentScope en todas las lecturas",
          ],
        ]}
      />
    </Stack>
  );
}

function UploadsTab() {
  return (
    <Stack gap={16}>
      <H2>Flujo de subida y validación</H2>
      <Callout tone="warning">
        upload-policy.ts cubre tamaño (20 MB), extensión allowlist y MIME por
        prefijo (incluye octet-stream). Falta magic bytes, antivirus y rechazo
        de multi-extensión peligrosa (malware.exe.pdf).
      </Callout>

      <Table
        headers={["Endpoint", "Política", "Gap"]}
        rows={[
          [
            "attachments / versions / import",
            "assertAllowedUpload",
            "Sin magic / AV / double-ext intermedia",
          ],
          [
            "digitize",
            "Ninguna",
            "Cualquier buffer → saveUpload",
          ],
          [
            "instruments multipart",
            "Solo rol admin",
            "Sin assertAllowedUpload",
          ],
          [
            "storage.saveUpload",
            "Sanitiza basename; anti-..",
            "Preserva extensión original",
          ],
          [
            "TRD Excel import",
            "Rol + buffer",
            "Debería forzar .xlsx + magic ZIP/OOXML",
          ],
        ]}
        rowTone={["warning", "danger", "danger", "neutral", "warning"]}
      />

      <H3>Checklist de endurecimiento</H3>
      <TodoList
        todos={[
          {
            id: "u1",
            content: "Rechazar cualquier sufijo en DENY (.exe .bat .js …) en el nombre",
            status: "pending",
          },
          {
            id: "u2",
            content: "Sniff magic bytes (PDF %PDF, JPEG FF D8, PNG, PK OOXML)",
            status: "pending",
          },
          {
            id: "u3",
            content: "Quitar allow de application/octet-stream sin magic OK",
            status: "pending",
          },
          {
            id: "u4",
            content: "CLAMAV_ENABLED + clamdscan (opcional ops)",
            status: "pending",
          },
          {
            id: "u5",
            content: "Cablear política en digitize + instruments",
            status: "pending",
          },
        ]}
      />
    </Stack>
  );
}

function PerfTab() {
  return (
    <Stack gap={16}>
      <H2>Rendimiento</H2>
      <Grid columns={3} gap={12}>
        <Stat value="~20" label="Queries dashboard" tone="warning" />
        <Stat value="15s" label="Polling campana" tone="warning" />
        <Stat value="5k" label="Tope export reportes" tone="neutral" />
      </Grid>

      <Table
        headers={["Área", "Problema", "Impacto", "Remedio"]}
        rows={[
          [
            "Dashboard",
            "getDashboardData ~19 queries + deps sin take",
            "Alto TTFB",
            "KPIs + 1 chart; resto lazy",
          ],
          [
            "Documentos",
            "page bypass listDocuments (cursor)",
            "Solo 100 fijos",
            "Usar cursor en UI",
          ],
          [
            "Archivo físico",
            "box/folder/location sin take",
            "SSR enorme",
            "Paginar / jerarquía lazy",
          ],
          [
            "TRD",
            "series+subseries sin take",
            "SSR crece con catálogo",
            "Paginación por dependencia",
          ],
          [
            "Loans notify",
            "N+1 notifyUser en serie",
            "Latencia approve",
            "createMany / Promise.all",
          ],
          [
            "Header",
            "live-bell poll 15s global",
            "Carga API constante",
            "visibilityState + backoff",
          ],
          [
            "Charts",
            "Recharts estático en dashboard",
            "JS inicial",
            "next/dynamic",
          ],
        ]}
        rowTone={[
          "warning",
          "warning",
          "danger",
          "warning",
          "warning",
          "warning",
          "neutral",
        ]}
      />
    </Stack>
  );
}

function UxTab() {
  return (
    <Stack gap={16}>
      <H2>Mejoras UX/UI por pantalla</H2>
      <Text tone="secondary" size="small">
        Accionables concretas (no genéricas). Priorizar filas con tono warning.
      </Text>

      <Table
        headers={["Pantalla", "Mejora 1", "Mejora 2"]}
        rows={[
          [
            "Login",
            "Errores ligados a campos (aria-invalid)",
            "Volver desde MFA sin recargar",
          ],
          [
            "Dashboard",
            "Quitar trends inventados (+12.5%)",
            "DeptHead: donut dice Serie pero usa dependencia",
          ],
          [
            "Documentos",
            "Arreglar thead (Creado fuera del tr)",
            "Filtros + cargar más con cursor",
          ],
          [
            "Doc nuevo",
            "Cascada serie→subserie en servidor",
            "CTA claro “Enviar a revisión”",
          ],
          [
            "Doc [id]",
            "Tabs Info|Archivos|Flujo|Timeline",
            "Barra sticky de acciones por rol",
          ],
          [
            "Digitalizar",
            "Empty state + CTA docs sin archivo",
            "Feedback inline por fila",
          ],
          [
            "Expedientes",
            "Crear en drawer, no arriba de tabla",
            "Código como link primario",
          ],
          [
            "Préstamos",
            "Autocomplete docs con debounce",
            "Filtros estado en servidor",
          ],
          [
            "Transferencias",
            "Acciones en fila (no solo /lifecycle)",
            "Filtro PENDING + badges",
          ],
          [
            "Aprobaciones",
            "Tabs Documentos|Préstamos|Transfers",
            "Badge pendientes en nav",
          ],
          [
            "Usuarios",
            "Buscar/filtrar rol y dependencia",
            "Confirm delete con email",
          ],
          [
            "Roles",
            "Permisos por módulo colapsable",
            "Warning al editar roles sistema",
          ],
          [
            "Dependencias",
            "CRUD o CTA gestionar",
            "Toggle activa inline",
          ],
          [
            "Backups",
            "Edad del último backup",
            "Descargar/verificar por fila",
          ],
          [
            "Auditoría",
            "Filtros fecha/módulo/usuario",
            "Drawer de changes",
          ],
          [
            "Settings",
            "Ocultar dump crudo de keys",
            "Marcar integrations como roadmap",
          ],
          [
            "Reportes",
            "Avisar tope 5000 filas",
            "Filtro dependencia + fechas",
          ],
          [
            "Archivo físico",
            "Vista jerárquica ubicación→caja",
            "Paginar / lazy",
          ],
          [
            "TRD",
            "Paginación / virtualización",
            "Sticky TRD activa + versión",
          ],
          [
            "Búsqueda",
            "Resultados → /documents/[id]",
            "Header search submit a /search",
          ],
          [
            "Notificaciones",
            "Campana navega a link",
            "Pausar poll si tab oculta",
          ],
          [
            "Perfil",
            "Cambiar password + MFA",
            "Link a /settings/security",
          ],
        ]}
      />

      <Divider />
      <H3>Controles UI rotos a corregir ya</H3>
      <Stack gap={4}>
        <Text size="small">
          Header: botón Menú sin handler (sidebar no colapsa en móvil)
        </Text>
        <Text size="small">
          Header: input búsqueda sin submit a /search
        </Text>
        <Text size="small">
          Consulta dashboard: input “búsqueda rápida” inerte
        </Text>
      </Stack>
    </Stack>
  );
}
