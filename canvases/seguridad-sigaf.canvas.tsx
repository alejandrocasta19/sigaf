import {
  BarChart,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Grid,
  H1,
  H2,
  LineChart,
  Stack,
  Stat,
  Table,
  Text,
  TodoList,
  UsageBar,
} from "cursor/canvas";

const APP_PCT = 88;
const GLOBAL_PCT = 82;
const LAN_PCT = 88;
const VPN_PCT = 85;
const INTERNET_PCT = 72;

const CONTROLES = [
  { area: "Auth JWT + sesiones revocables", pct: 90 },
  { area: "MFA TOTP + obligatorio admin (prod)", pct: 92 },
  { area: "RBAC + anti-escalada + tenant", pct: 88 },
  { area: "CSRF double-submit + Origin", pct: 90 },
  { area: "Headers (CSP, HSTS, XFO, nosniff)", pct: 88 },
  { area: "Uploads (magic bytes, anti double-ext)", pct: 85 },
  { area: "Auditoría + rate limit + alertas login", pct: 82 },
  { area: "Validación secretos al arrancar (prod)", pct: 85 },
  { area: "Suite npm run test:security", pct: 78 },
  { area: "ClamAV antivirus (opcional)", pct: 65 },
  { area: "CVEs npm / dependencias", pct: 50 },
  { area: "Infra: WAF, TLS, pentest, LDAP", pct: 35 },
];

const HISTORIA = [
  { corte: "Pre-endurecimiento", pct: 74 },
  { corte: "CSRF + headers + uploads", pct: 83 },
  { corte: "MFA prod + RBAC rutas", pct: 88 },
];

export default function SeguridadSigafCanvas() {
  return (
    <Stack gap={20} style={{ padding: 20, maxWidth: 1080 }}>
      <Stack gap={6}>
        <H1>Seguridad SIGAF — 18 ago 2026</H1>
        <Text tone="secondary" size="small">
          Postura basada en código, docs/security-go-live.md y test:security · no sustituye pentest externo
        </Text>
      </Stack>

      <Grid columns={5} gap={10}>
        <Stat value="88%" label="Controles en app" tone="success" />
        <Stat value="82%" label="Postura global" />
        <Stat value="+5 pts" label="vs. corte 83%" />
        <Stat value="Go" label="Demo / LAN" tone="success" />
        <Stat value="Condicional" label="Internet" tone="warning" />
      </Grid>

      <UsageBar
        total={100}
        topLeftLabel="Controles de aplicación (auth, RBAC, CSRF, uploads, headers)"
        topRightLabel={`${APP_PCT} / 100`}
        segments={[{ id: "app", value: APP_PCT, color: "green" }]}
      />
      <UsageBar
        total={100}
        topLeftLabel="Postura global (app + deps + infra + pentest)"
        topRightLabel={`${GLOBAL_PCT} / 100`}
        segments={[{ id: "global", value: GLOBAL_PCT, color: "yellow" }]}
      />

      <Callout tone="success" title="Cerrado desde la última revisión">
        CSRF double-submit cableado (cookie + X-CSRF-Token). MFA obligatorio para admins en producción.
        Validación de secretos al arrancar. HSTS en middleware. RBAC reforzado en rutas API sensibles.
      </Callout>

      <H2>Evolución postura de seguridad</H2>
      <LineChart
        categories={HISTORIA.map((h) => h.corte)}
        series={[{ name: "Controles app (%)", data: HISTORIA.map((h) => h.pct) }]}
        height={200}
      />

      <H2>Avance por control (%)</H2>
      <BarChart
        horizontal
        height={360}
        yMax={100}
        valueSuffix="%"
        categories={CONTROLES.map((c) => c.area)}
        series={[{ name: "Completitud estimada (%)", data: CONTROLES.map((c) => c.pct) }]}
        referenceLines={[{ value: APP_PCT, label: "App 88%", tone: "info" }]}
      />

      <H2>Matriz de controles</H2>
      <Table
        columns={[
          { key: "control", header: "Control", width: "40%" },
          { key: "estado", header: "Estado", width: "15%" },
          { key: "notas", header: "Notas", width: "45%" },
        ]}
        rows={[
          { control: "JWT + sessionId + logout revocable", estado: "✓", notas: "Cookie HttpOnly, SameSite=Lax" },
          { control: "MFA TOTP", estado: "✓", notas: "Opcional por usuario; obligatorio admin en prod" },
          { control: "CSRF double-submit", estado: "✓", notas: "sigaf_csrf + X-CSRF-Token + Origin" },
          { control: "Rate limit login + API", estado: "✓", notas: "In-memory; no multi-nodo sin Redis" },
          { control: "HSTS + CSP + XFO + nosniff", estado: "✓", notas: "middleware + security-headers.ts" },
          { control: "Política contraseñas (≥10 chars)", estado: "✓", notas: "Validada en identity-service" },
          { control: "Omit passwordHash/mfaSecret", estado: "✓", notas: "USER_PUBLIC_SELECT" },
          { control: "Anti-escalada de roles", estado: "✓", notas: "accessLevel en identity-service" },
          { control: "Uploads magic + double-ext", estado: "✓", notas: "ClamAV opcional (CLAMAV_ENABLED)" },
          { control: "Secretos prod al arrancar", estado: "✓", notas: "instrumentation.ts bloquea valores demo" },
          { control: "Validación sesión en BD (middleware)", estado: "Parcial", notas: "JWT firmado; revocación vía sessionId" },
          { control: "npm audit / CVEs", estado: "Pendiente", notas: "Upgrade Next/sharp planificado" },
          { control: "WAF / pentest externo", estado: "No", notas: "Obligatorio para internet institucional" },
          { control: "LDAP / SSO corporativo", estado: "No", notas: "Flag en settings; sin conector" },
        ]}
      />

      <Grid columns={2} gap={16}>
        <Card>
          <CardHeader title="Listo según exposición" />
          <CardBody>
            <Table
              columns={[
                { key: "escenario", header: "Escenario", width: "55%" },
                { key: "nivel", header: "Nivel", width: "45%" },
              ]}
              rows={[
                { escenario: "Demo / LAN", nivel: `${LAN_PCT}% — Go con secretos no-demo` },
                { escenario: "Intranet VPN", nivel: `${VPN_PCT}% — HTTPS + MFA admin + backups` },
                { escenario: "Internet público", nivel: `${INTERNET_PCT}% — Condicional (WAF + pentest)` },
              ]}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Top 5 para subir a ~95% app" />
          <CardBody>
            <TodoList
              items={[
                { id: "1", label: "Rate limit distribuido (Redis) para multi-nodo", status: "pending" },
                { id: "2", label: "Plan upgrade npm audit (Next/sharp CVEs)", status: "pending" },
                { id: "3", label: "Activar ClamAV en staging/prod", status: "pending" },
                { id: "4", label: "Auditoría RBAC exhaustiva en todas las rutas API", status: "pending" },
                { id: "5", label: "Pentest externo OWASP ASVS antes de go-live", status: "pending" },
              ]}
            />
          </CardBody>
        </Card>
      </Grid>

      <Callout tone="warning" title="El 88% de app ≠ listo para internet">
        Faltan TLS real delante de Node, Postgres no expuesto, WAF/perímetro, pentest contratado y
        operación (backups con restore probado). npm run test:security es smoke interna, no ASVS completo.
      </Callout>
    </Stack>
  );
}
