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

const GLOBAL = 89;

const AREAS = [
  { area: "Expedientes + 6 pasos archivísticos", pct: 92 },
  { area: "TRD / instrumentos", pct: 90 },
  { area: "FUID / inventarios AGN", pct: 90 },
  { area: "Dashboard / admin", pct: 90 },
  { area: "Identidad / RBAC / MFA", pct: 90 },
  { area: "Documentos + workflow", pct: 90 },
  { area: "Seguridad (código)", pct: 88 },
  { area: "Transferencias / ciclo vital", pct: 88 },
  { area: "Archivo físico", pct: 88 },
  { area: "Préstamos", pct: 85 },
  { area: "UI móvil / responsive", pct: 85 },
  { area: "Organizaciones / settings", pct: 85 },
  { area: "Reportes / import-export", pct: 82 },
  { area: "Despliegue producción", pct: 65 },
  { area: "Paginación / escala UI", pct: 60 },
  { area: "Tests / QA automatizado", pct: 55 },
  { area: "Digitalización / OCR", pct: 75 },
  { area: "Búsqueda avanzada", pct: 72 },
  { area: "Notificaciones email", pct: 70 },
  { area: "Almacenamiento cloud (S3)", pct: 70 },
  { area: "Integraciones (LDAP, webhooks)", pct: 25 },
];

const HISTORIA = [
  { corte: "Ene 2026 — núcleo básico", pct: 63 },
  { corte: "Mar — expediente + FUID", pct: 78 },
  { corte: "Ago — móvil + seguridad", pct: 86 },
  { corte: "Ago — auditoría metodológica", pct: 89 },
];

const PENDIENTES = [
  { id: "1", label: "Go-live internet (HTTPS, pentest, WAF, backups restore)", status: "pending" as const },
  { id: "2", label: "Paginación UI conectada al cursor API (listas take:100)", status: "pending" as const },
  { id: "3", label: "LDAP/AD + S3 para archivos digitalizados", status: "pending" as const },
  { id: "4", label: "SMTP operativo para alertas y préstamos vencidos", status: "pending" as const },
  { id: "5", label: "Tests e2e por rol (6 cuentas demo COOTRANSHUILA)", status: "pending" as const },
];

export default function AvanceSigafCanvas() {
  return (
    <Stack gap={20} style={{ padding: 20, maxWidth: 1080 }}>
      <Stack gap={6}>
        <H1>Avance de SIGAF — 18 ago 2026</H1>
        <Text tone="secondary" size="small">
          Estimación funcional sobre alcance institucional COOTRANSHUILA · no es conteo de líneas
        </Text>
      </Stack>

      <Grid columns={4} gap={12}>
        <Stat value="89%" label="Completitud global" tone="success" />
        <Stat value="+3 pts" label="vs. corte anterior (86%)" />
        <Stat value="~92%" label="Demo / LAN / VPN" tone="success" />
        <Stat value="~72%" label="Internet público" tone="warning" />
      </Grid>

      <UsageBar
        total={100}
        topLeftLabel="Avance global (alcance funcional)"
        topRightLabel={`${GLOBAL} / 100`}
        segments={[{ id: "hecho", value: GLOBAL, color: "green" }]}
      />

      <Callout tone="info" title="Qué significa el 89%">
        El ciclo archivístico completo ya opera: identificación → clasificación TRD → ordenación →
        foliación → rotulación → FUID → transferencia primaria. El salto a producción institucional
        depende más de infraestructura e integraciones que de features nuevas.
      </Callout>

      <H2>Evolución del avance</H2>
      <LineChart
        categories={HISTORIA.map((h) => h.corte)}
        series={[{ name: "Completitud (%)", data: HISTORIA.map((h) => h.pct) }]}
        height={220}
      />
      <Text tone="secondary" size="small">
        Fuente: estimación interna · cortes por hitos de desarrollo
      </Text>

      <H2>Avance por módulo (%)</H2>
      <BarChart
        categories={AREAS.map((a) => a.area)}
        series={[{ name: "Avance estimado (%)", data: AREAS.map((a) => a.pct) }]}
        height={420}
      />

      <Card>
        <CardHeader title="Detalle por área" />
        <CardBody padding={0}>
          <Table
            columns={[
              { key: "area", header: "Área", width: "55%" },
              { key: "pct", header: "Avance", align: "right", width: "15%" },
              { key: "estado", header: "Estado", width: "30%" },
            ]}
            rows={AREAS.map((a) => ({
              area: a.area,
              pct: `${a.pct}%`,
              estado: a.pct >= 88 ? "Operativo" : a.pct >= 70 ? "Parcial" : "Pendiente",
            }))}
          />
        </CardBody>
      </Card>

      <H2>Incremento reciente (+3 pts)</H2>
      <Table
        columns={[
          { key: "cambio", header: "Mejora", width: "50%" },
          { key: "impacto", header: "Impacto", align: "right", width: "15%" },
          { key: "evidencia", header: "Evidencia", width: "35%" },
        ]}
        rows={[
          { cambio: "Paso 1 identificación real + trámite único", impacto: "+0.5%", evidencia: "classification-wizard.tsx" },
          { cambio: "Retención TRD como fuente única", impacto: "+0.5%", evidencia: "resolveTrdRetention()" },
          { cambio: "Serie simple / compuesta + validación", impacto: "+0.5%", evidencia: "seriesKind en Prisma" },
          { cambio: "FUID editable + cabecera AGN", impacto: "+0.5%", evidencia: "fuid-inventory-panel.tsx" },
          { cambio: "Foliación física trazable + etiqueta caja", impacto: "+0.5%", evidencia: "expediente-archival-hub" },
          { cambio: "Dashboard sin KPIs ficticios", impacto: "+0.5%", evidencia: "dashboard/page.tsx" },
        ]}
      />

      <Card>
        <CardHeader title="Top 5 para production-ready" />
        <CardBody>
          <TodoList items={PENDIENTES} />
        </CardBody>
      </Card>
    </Stack>
  );
}
