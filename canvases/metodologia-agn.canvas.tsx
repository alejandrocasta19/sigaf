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

const GLOBAL_PCT = 91;
const PROCESO_PCT = 92;
const TRD_PCT = 90;
const TRANSFER_PCT = 88;

const SEIS_PASOS = [
  { paso: "1. Identificación", pct: 90, estado: "Operativo" },
  { paso: "2. Clasificación", pct: 93, estado: "Cumplido" },
  { paso: "3. Ordenación", pct: 95, estado: "Cumplido" },
  { paso: "4. Foliación", pct: 92, estado: "Cumplido" },
  { paso: "5. Rotulación", pct: 90, estado: "Cumplido" },
  { paso: "6. FUID", pct: 85, estado: "Parcial" },
];

const TRANSVERSAL = [
  { area: "TRD retención fuente única", pct: 92 },
  { area: "Serie simple / compuesta", pct: 85 },
  { area: "Un trámite = un expediente", pct: 93 },
  { area: "Inicio retención (eventos TRD)", pct: 88 },
  { area: "Archivo físico + procedencia", pct: 90 },
  { area: "Transferencia primaria guiada", pct: 88 },
  { area: "Ciclo vital AG → AC → Histórico", pct: 90 },
  { area: "TRD versiones / import Excel", pct: 90 },
];

const HISTORIA = [
  { corte: "Pre-auditoría metodológica", pct: 78 },
  { corte: "6 pasos estructurados", pct: 84 },
  { corte: "Post-mejoras 18 ago", pct: 91 },
];

export default function MetodologiaAgnCanvas() {
  return (
    <Stack gap={20} style={{ padding: 20, maxWidth: 1080 }}>
      <Stack gap={6}>
        <H1>Metodología archivística AGN / COOTRANSHUILA</H1>
        <Text tone="secondary" size="small">
          Cumplimiento funcional vs. video 6 pasos + TRD institucional · 18 ago 2026
        </Text>
      </Stack>

      <Grid columns={4} gap={12}>
        <Stat value="91%" label="Cumplimiento global" tone="success" />
        <Stat value="92%" label="Proceso 6 pasos" tone="success" />
        <Stat value="90%" label="TRD / retención" />
        <Stat value="+13 pts" label="vs. pre-auditoría (~78%)" />
      </Grid>

      <UsageBar
        total={100}
        topLeftLabel="Alineación metodológica AGN + COOTRANSHUILA"
        topRightLabel={`${GLOBAL_PCT} / 100`}
        segments={[{ id: "agn", value: GLOBAL_PCT, color: "green" }]}
      />

      <Callout tone="success" title="Fortalezas estructurales">
        Los 6 pasos existen como entidad de dominio (IDENTIFICATION → FUID_INVENTORY), con reglas de
        negocio en transferencia, archivo físico y hub del expediente. La TRD es ahora fuente única
        de retención.
      </Callout>

      <H2>Evolución del cumplimiento</H2>
      <LineChart
        categories={HISTORIA.map((h) => h.corte)}
        series={[{ name: "Cumplimiento metodológico (%)", data: HISTORIA.map((h) => h.pct) }]}
        height={200}
      />

      <H2>Los 6 pasos del proceso documental</H2>
      <BarChart
        categories={SEIS_PASOS.map((s) => s.paso)}
        series={[{ name: "Cumplimiento (%)", data: SEIS_PASOS.map((s) => s.pct) }]}
        height={280}
        referenceLines={[{ value: 90, label: "Umbral operativo 90%", tone: "info" }]}
      />
      <Table
        columns={[
          { key: "paso", header: "Paso", width: "35%" },
          { key: "pct", header: "%", align: "right", width: "10%" },
          { key: "estado", header: "Estado", width: "15%" },
          { key: "gap", header: "Gap principal", width: "40%" },
        ]}
        rows={[
          { paso: "1. Identificación", pct: "90%", estado: "🟢", gap: "Checklist manual; sin consulta TRD en línea" },
          { paso: "2. Clasificación", pct: "93%", estado: "🟢", gap: "Wizard completo; serie simple validada al agregar docs" },
          { paso: "3. Ordenación", pct: "95%", estado: "🟢", gap: "Reorden + validación cronológica automática" },
          { paso: "4. Foliación", pct: "92%", estado: "🟢", gap: "Trazabilidad física añadida; falta en checklist transferencia" },
          { paso: "5. Rotulación", pct: "90%", estado: "🟢", gap: "PDF carpeta/caja COOTRANSHUILA; plantillas institucionales finas" },
          { paso: "6. FUID", pct: "85%", estado: "🟡", gap: "Formulario editable; falta PDF/XML AGN oficial" },
        ]}
      />

      <H2>Controles transversales TRD</H2>
      <BarChart
        horizontal
        height={280}
        yMax={100}
        valueSuffix="%"
        categories={TRANSVERSAL.map((t) => t.area)}
        series={[{ name: "Cumplimiento (%)", data: TRANSVERSAL.map((t) => t.pct) }]}
      />

      <Grid columns={2} gap={16}>
        <Card>
          <CardHeader title="Reglas de negocio activas" />
          <CardBody>
            <Table
              columns={[
                { key: "regla", header: "Regla", width: "55%" },
                { key: "estado", header: "Estado", width: "45%" },
              ]}
              rows={[
                { regla: "Un trámite = un expediente único", estado: "✓ Validación al crear" },
                { regla: "Retención desde TRD (serie/subserie)", estado: "✓ resolveTrdRetention()" },
                { regla: "Serie simple → un tipo documental", estado: "✓ Al agregar documentos" },
                { regla: "Principio de procedencia (caja)", estado: "✓ physical-service.ts" },
                { regla: "Orden cronológico original", estado: "✓ Validación en archivo físico" },
                { regla: "8 checks transferencia primaria", estado: "✓ guided-transfer-wizard" },
                { regla: "Ciclo MANAGEMENT → CENTRAL → HISTORICAL", estado: "✓ archivalPhase" },
              ]}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Top 5 para llegar a ~97%" />
          <CardBody>
            <TodoList
              items={[
                { id: "1", label: "FUID: export PDF/XML AGN + validación normativa campo a campo", status: "pending" },
                { id: "2", label: "Identificación: verificación automática contra TRD vigente", status: "pending" },
                { id: "3", label: "Foliación física en checklist de transferencia", status: "pending" },
                { id: "4", label: "Cálculo retención 100% basado en evento (no fecha doc + AG)", status: "pending" },
                { id: "5", label: "Plantillas rotulación institucionales pixel-perfect", status: "pending" },
              ]}
            />
          </CardBody>
        </Card>
      </Grid>

      <Callout tone="info" title="Lectura del 91%">
        SIGAF cumple conceptual y operativamente el flujo AGN de 6 pasos. El gap restante es
        formalización (FUID PDF AGN), automatización de identificación TRD y pulido de plantillas —
        no la estructura archivística, que ya es sólida.
      </Callout>
    </Stack>
  );
}
