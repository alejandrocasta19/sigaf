import {
  BarChart,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Grid,
  H1,
  H2,
  Stack,
  Stat,
  Table,
  Text,
  TodoList,
  UsageBar,
} from "cursor/canvas";

const ACTUAL = 97.5;
const META = 97;

const ROADMAP = [
  {
    id: "P1",
    titulo: "Foliación física en checklist de transferencia",
    impacto: 2,
    esfuerzo: 1,
    pct: "+1.5",
    semanas: "0.5",
    deps: "Ninguna",
    archivos: "expediente-cycle.ts, guided-transfer-wizard.tsx",
  },
  {
    id: "P2",
    titulo: "Retención 100% por evento de inicio",
    impacto: 3,
    esfuerzo: 2,
    pct: "+2.0",
    semanas: "1",
    deps: "Ninguna",
    archivos: "expediente-cycle-service.ts, expediente-archival-service.ts",
  },
  {
    id: "P3",
    titulo: "Identificación automática contra TRD vigente",
    impacto: 2,
    esfuerzo: 2,
    pct: "+1.0",
    semanas: "1",
    deps: "P2 recomendado",
    archivos: "classification-wizard.tsx, API preview TRD",
  },
  {
    id: "P4",
    titulo: "FUID export PDF AGN (Anexo 3)",
    impacto: 3,
    esfuerzo: 3,
    pct: "+1.5",
    semanas: "1.5–2",
    deps: "Formulario FUID editable (hecho)",
    archivos: "fuid-service.ts, /api/v1/inventories/fuid",
  },
  {
    id: "P5",
    titulo: "Plantillas rotulación COOTRANSHUILA pixel-perfect",
    impacto: 1,
    esfuerzo: 2,
    pct: "+0.5",
    semanas: "1",
    deps: "Ninguna",
    archivos: "label-service.ts, assets/plantillas",
  },
];

export default function RoadmapMetodologiaCanvas() {
  return (
    <Stack gap={20} style={{ padding: 20, maxWidth: 1080 }}>
      <Stack gap={6}>
        <H1>Roadmap metodológico 91% → 97%</H1>
        <Text tone="secondary" size="small">
          Priorizado por impacto ÷ esfuerzo · estimado ~4–5 semanas · 18 ago 2026
        </Text>
      </Stack>

      <Grid columns={4} gap={12}>
        <Stat value="91%" label="Hoy" />
        <Stat value="97%" label="Meta" tone="success" />
        <Stat value="+6 pts" label="Por cerrar" />
        <Stat value="~5 sem" label="Duración estimada" />
      </Grid>

      <UsageBar
        total={100}
        topLeftLabel="Cumplimiento metodológico AGN"
        topRightLabel={`${ACTUAL} → ${META}`}
        segments={[
          { id: "hecho", value: ACTUAL, color: "green" },
          { id: "pendiente", value: META - ACTUAL, color: "gray" },
        ]}
      />

      <Callout tone="info" title="Criterio de priorización">
        Primero quick wins con reglas de negocio (P1–P2), luego automatización TRD (P3), después
        entregables formales AGN (P4–P5). Cada ítem suma ~0.5–2 pts al cumplimiento metodológico.
      </Callout>

      <H2>Impacto vs. esfuerzo (1=bajo, 3=alto)</H2>
      <BarChart
        categories={ROADMAP.map((r) => r.id + " " + r.titulo.slice(0, 28))}
        series={[
          { name: "Impacto metodológico", data: ROADMAP.map((r) => r.impacto) },
          { name: "Esfuerzo dev (invertido: 4−e)", data: ROADMAP.map((r) => 4 - r.esfuerzo) },
        ]}
        height={260}
      />
      <Text size="small" tone="secondary">
        Eje Y: escala 1–3 · Esfuerzo mostrado invertido (más alto = más fácil)
      </Text>

      <H2>Orden de implementación</H2>
      <Table
        columns={[
          { key: "orden", header: "#", width: "5%" },
          { key: "titulo", header: "Ítem", width: "30%" },
          { key: "pct", header: "Δ%", align: "right", width: "8%" },
          { key: "sem", header: "Semanas", width: "10%" },
          { key: "deps", header: "Dependencias", width: "22%" },
          { key: "archivos", header: "Archivos clave", width: "25%" },
        ]}
        rows={ROADMAP.map((r, i) => ({
          orden: String(i + 1),
          titulo: r.titulo,
          pct: r.pct,
          sem: r.semanas,
          deps: r.deps,
          archivos: r.archivos,
        }))}
      />

      <Grid columns={2} gap={16}>
        <Card>
          <CardHeader title="Sprint 1 — Semana 1 (quick wins)" />
          <CardBody>
            <TodoList
              items={[
                { id: "s1a", label: "P1: physicalFoliationDone en evaluateExpedienteReadiness", status: "done" },
                { id: "s1b", label: "P2: Unificar cálculo retentionDueAt por retentionStartEvent", status: "done" },
                { id: "s1c", label: "Tests: ciclo cerrar expediente → fecha retención correcta", status: "done" },
              ]}
            />
            <Text size="small" tone="secondary" style={{ marginTop: 8 }}>
              Entrega: +3.5 pts · checklist transferencia más estricto y retención confiable
            </Text>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Sprint 2 — Semana 2 (TRD en línea)" />
          <CardBody>
            <TodoList
              items={[
                { id: "s2a", label: "P3: API GET /trd/identification + validación serie/subserie", status: "done" },
                { id: "s2b", label: "P3: Checklist identificación auto-validado en wizard", status: "done" },
                { id: "s2c", label: "P3: Alerta si TRD tiene versión más nueva que la usada", status: "done" },
              ]}
            />
            <Text size="small" tone="secondary" style={{ marginTop: 8 }}>
              Entrega: +1 pt · identificación deja de ser solo declaración manual
            </Text>
          </CardBody>
        </Card>
      </Grid>

      <Grid columns={2} gap={16}>
        <Card>
          <CardHeader title="Sprint 3 — Semanas 3–4 (formalización AGN)" />
          <CardBody>
            <TodoList
              items={[
                { id: "s3a", label: "P4: Generar PDF FUID con layout Anexo 3 AGN 001/2024", status: "done" },
                { id: "s3b", label: "P4: Botón Exportar PDF junto a Excel en inventarios", status: "done" },
                { id: "s3c", label: "P4: Validación campo obligatorio antes de marcar VALIDATED", status: "done" },
              ]}
            />
            <Text size="small" tone="secondary" style={{ marginTop: 8 }}>
              Entrega: +1.5 pts · FUID pasa de operativo a formalmente presentable al Archivo Central
            </Text>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Sprint 4 — Semana 5 (pulido institucional)" />
          <CardBody>
            <TodoList
              items={[
                { id: "s4a", label: "P5: Plantilla PDF carpeta/caja según formato COOTRANSHUILA", status: "done" },
                { id: "s4b", label: "P5: Vista previa rotulación en hub antes de imprimir", status: "done" },
                { id: "s4c", label: "Demo end-to-end con Archivo Central (aceptación UAT)", status: "pending" },
              ]}
            />
            <Text size="small" tone="secondary" style={{ marginTop: 8 }}>
              Entrega: +0.5 pts · cierre visual institucional
            </Text>
          </CardBody>
        </Card>
      </Grid>

      <Callout tone="success" title="Resultado esperado al completar">
        91% + 1.5 + 2.0 + 1.0 + 1.5 + 0.5 ≈ 97%. SIGAF quedaría listo para auditoría metodológica
        interna COOTRANSHUILA y transferencia primaria real con soporte documental AGN completo.
      </Callout>
    </Stack>
  );
}
