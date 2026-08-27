import {
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Grid,
  H1,
  H2,
  Stack,
  Stat,
  Text,
  TodoList,
  UsageBar,
  Row,
  useCanvasState,
} from "cursor/canvas";

type TodoStatus = "pending" | "in_progress" | "completed" | "cancelled";

type UatItem = {
  id: string;
  section: string;
  content: string;
  role: string;
  route: string;
  expected: string;
};

const UAT_ITEMS: UatItem[] = [
  // Pre-requisitos
  {
    id: "pre-1",
    section: "Pre-requisitos",
    content: "Servidor SIGAF accesible en http://localhost:3000",
    role: "Facilitador",
    route: "/login",
    expected: "Página de login carga sin error 500",
  },
  {
    id: "pre-2",
    section: "Pre-requisitos",
    content: "Base de datos con seed COOTRANSHUILA y TRD activa",
    role: "Facilitador",
    route: "/trd",
    expected: "TRD vigente visible con series documentales",
  },
  {
    id: "pre-3",
    section: "Pre-requisitos",
    content: "Asistentes presentes: Archivo Central + dependencia productora",
    role: "Facilitador",
    route: "—",
    expected: "Roles documental@ y funcionario@ disponibles",
  },
  {
    id: "pre-4",
    section: "Pre-requisitos",
    content: "Expediente de prueba limpio o crear uno nuevo durante la demo",
    role: "Facilitador",
    route: "/expedientes",
    expected: "Listado de expedientes accesible",
  },

  // Paso 1 — Identificación
  {
    id: "p1-1",
    section: "1. Identificación",
    content: "Abrir asistente crear expediente — paso 1 TRD vigente",
    role: "Funcionario dependencia",
    route: "/expedientes",
    expected: "Panel TRD activa + checklist identificación automático",
  },
  {
    id: "p1-2",
    section: "1. Identificación",
    content: "Completar dependencia, serie, asunto — checks se marcan solos",
    role: "Funcionario dependencia",
    route: "/expedientes (wizard pasos 2–6)",
    expected: "Progreso identificación 5/5 antes de crear",
  },
  {
    id: "p1-3",
    section: "1. Identificación",
    content: "Intentar asunto duplicado en misma dependencia",
    role: "Funcionario dependencia",
    route: "Wizard paso 6",
    expected: "Alerta de expediente duplicado; no permite avanzar",
  },
  {
    id: "p1-4",
    section: "1. Identificación",
    content: "Crear expediente con identificationConfirmed",
    role: "Funcionario dependencia",
    route: "/expedientes → detalle",
    expected: "Expediente creado; paso IDENTIFICATION marcado en hub",
  },

  // Paso 2 — Clasificación
  {
    id: "p2-1",
    section: "2. Clasificación",
    content: "Verificar jerarquía Fondo → Sección → Serie → Expediente",
    role: "Archivo Central",
    route: "/expedientes/[id] → Hub archivístico",
    expected: "Árbol jerárquico coincide con TRD seleccionada",
  },
  {
    id: "p2-2",
    section: "2. Clasificación",
    content: "Retención AG/AC y disposición final desde TRD (no manual)",
    role: "Archivo Central",
    route: "Hub → Retención TRD",
    expected: "Valores coinciden con serie/subserie TRD activa",
  },
  {
    id: "p2-3",
    section: "2. Clasificación",
    content: "Serie simple: solo un tipo documental por expediente",
    role: "Funcionario dependencia",
    route: "Agregar documento",
    expected: "Validación impide mezclar tipos en serie SIMPLE",
  },

  // Paso 3 — Ordenación
  {
    id: "p3-1",
    section: "3. Ordenación",
    content: "Agregar 2+ documentos al expediente",
    role: "Funcionario dependencia",
    route: "Hub → Agregar documento",
    expected: "Documentos listados con soporte y folios",
  },
  {
    id: "p3-2",
    section: "3. Ordenación",
    content: "Reordenar documentos (↑↓) y guardar con auditoría",
    role: "Funcionario dependencia",
    route: "Hub → Orden documental",
    expected: "Orden persistido; paso ORDERING marcado",
  },

  // Paso 4 — Foliación
  {
    id: "p4-1",
    section: "4. Foliación",
    content: "Validar foliación digital (conteo automático de folios)",
    role: "Funcionario dependencia",
    route: "Hub → Foliación",
    expected: "Rango de folios calculado por documento",
  },
  {
    id: "p4-2",
    section: "4. Foliación",
    content: "Registrar foliación física: responsable, método, fecha",
    role: "Funcionario dependencia",
    route: "Hub → Foliación física",
    expected: "Trazabilidad guardada; paso FOLIATION marcado",
  },

  // Paso 5 — Rotulación
  {
    id: "p5-1",
    section: "5. Rotulación",
    content: "Vista previa etiqueta carpeta (100×140 mm COOTRANSHUILA)",
    role: "Archivo Central",
    route: "Hub → Rotulación → Carpeta",
    expected: "Mockup + iframe PDF inline correctos",
  },
  {
    id: "p5-2",
    section: "5. Rotulación",
    content: "Vista previa y descarga etiqueta caja con QR",
    role: "Archivo Central",
    route: "Hub → Rotulación → Caja",
    expected: "PDF con cabecera institucional + QR CAJ: código",
  },
  {
    id: "p5-3",
    section: "5. Rotulación",
    content: "Guardar número carpeta/caja y fechas extremas",
    role: "Funcionario dependencia",
    route: "Hub → Guardar rotulación",
    expected: "Datos persistidos; paso LABELING marcado",
  },

  // Paso 6 — FUID
  {
    id: "p6-1",
    section: "6. Inventario FUID",
    content: "Generar inventario FUID desde expediente o panel global",
    role: "Archivo Central",
    route: "/inventories",
    expected: "Inventario INV-AAAA-NNNN con ítems derivados",
  },
  {
    id: "p6-2",
    section: "6. Inventario FUID",
    content: "Editar cabecera AGN (entidades, objeto, NT) e ítems",
    role: "Archivo Central",
    route: "/inventories → Editar FUID",
    expected: "Formulario editable guarda cambios",
  },
  {
    id: "p6-3",
    section: "6. Inventario FUID",
    content: "Exportar FUID Excel y PDF Anexo 3 AGN 001/2024",
    role: "Archivo Central",
    route: "/api/v1/inventories/fuid",
    expected: "Ambos archivos descargan con cabecera y 17 columnas",
  },
  {
    id: "p6-4",
    section: "6. Inventario FUID",
    content: "Validar inventario — bloqueo si faltan campos obligatorios",
    role: "Archivo Central",
    route: "/inventories → Validar",
    expected: "Error descriptivo si falta cabecera/fechas; VALIDATED si completo",
  },

  // Transferencia primaria
  {
    id: "tr-1",
    section: "Transferencia primaria",
    content: "Cerrar expediente e iniciar retención por evento TRD",
    role: "Jefe dependencia",
    route: "Hub → Cerrar expediente",
    expected: "retentionDueAt calculado según evento configurado",
  },
  {
    id: "tr-2",
    section: "Transferencia primaria",
    content: "Checklist readiness: foliación física + digital requeridas",
    role: "Archivo Central",
    route: "Hub → Listo para transferencia",
    expected: "Ítems pendientes visibles hasta completar todos",
  },
  {
    id: "tr-3",
    section: "Transferencia primaria",
    content: "Wizard transferencia primaria guiada (8 pasos)",
    role: "Archivo Central",
    route: "/transfers",
    expected: "Checklist TRD cumplido antes de enviar al Archivo Central",
  },

  // TRD administración
  {
    id: "trd-1",
    section: "TRD institucional",
    content: "Consultar TRD activa: series, retención, disposición",
    role: "Archivo Central",
    route: "/trd",
    expected: "Versión activa, series simple/compuesta distinguibles",
  },
  {
    id: "trd-2",
    section: "TRD institucional",
    content: "Retención expediente = valores TRD (fuente única)",
    role: "Archivo Central",
    route: "Expediente cerrado",
    expected: "No hay retención manual fuera de TRD",
  },

  // Seguridad y roles
  {
    id: "seg-1",
    section: "Seguridad y roles",
    content: "Funcionario dependencia: solo ve su dependencia",
    role: "funcionario@sigaf.local",
    route: "/expedientes, /documents",
    expected: "Filtrado por dependencia; sin acceso admin",
  },
  {
    id: "seg-2",
    section: "Seguridad y roles",
    content: "Usuario consulta: solo lectura, sin crear/editar",
    role: "consulta@sigaf.local",
    route: "/expedientes",
    expected: "Sin botones de creación ni edición",
  },
  {
    id: "seg-3",
    section: "Seguridad y roles",
    content: "Auditoría: acciones FUID_EXPORT y cambios archivísticos",
    role: "Super admin",
    route: "/audit",
    expected: "Eventos registrados con usuario, módulo e IP",
  },

  // Cierre UAT
  {
    id: "close-1",
    section: "Cierre UAT",
    content: "Recorrer los 6 pasos AGN en un expediente end-to-end",
    role: "Archivo Central",
    route: "Flujo completo",
    expected: "Barra proceso documental al 100%",
  },
  {
    id: "close-2",
    section: "Cierre UAT",
    content: "Registrar observaciones / no conformidades encontradas",
    role: "Facilitador",
    route: "Acta UAT",
    expected: "Lista de ítems fallidos con responsable y fecha",
  },
  {
    id: "close-3",
    section: "Cierre UAT",
    content: "Firma acta de aceptación COOTRANSHUILA",
    role: "Archivo Central + TI",
    route: "—",
    expected: "Aprobado / Aprobado con observaciones / Rechazado",
  },
];

const SECTIONS = [
  "Pre-requisitos",
  "1. Identificación",
  "2. Clasificación",
  "3. Ordenación",
  "4. Foliación",
  "5. Rotulación",
  "6. Inventario FUID",
  "Transferencia primaria",
  "TRD institucional",
  "Seguridad y roles",
  "Cierre UAT",
];

const DEMO_USERS = [
  { email: "documental@sigaf.local", rol: "DOC_ADMIN — Archivo Central" },
  { email: "funcionario@sigaf.local", rol: "DEPT_WORKER — Dependencia" },
  { email: "jefe@sigaf.local", rol: "DEPT_HEAD — Jefe dependencia" },
  { email: "super@sigaf.local", rol: "SUPER_ADMIN — Facilitador demo" },
  { email: "consulta@sigaf.local", rol: "CONSULT_USER — Solo lectura" },
];

export default function UatDemoSigafCanvas() {
  const [statuses, setStatuses] = useCanvasState<Record<string, TodoStatus>>("uat-statuses", {});
  const [activeId, setActiveId] = useCanvasState<string | null>("uat-active", null);

  const todos = UAT_ITEMS.map((item) => ({
    id: item.id,
    content: `[${item.role.split(" ")[0]}] ${item.content}`,
    status: statuses[item.id] ?? ("pending" as TodoStatus),
  }));

  const completed = todos.filter((t) => t.status === "completed").length;
  const total = todos.length;
  const pct = Math.round((completed / total) * 100);

  function toggleTodo(id: string) {
    setStatuses((prev) => ({
      ...prev,
      [id]: prev[id] === "completed" ? "pending" : "completed",
    }));
    setActiveId(id);
  }

  function resetAll() {
    setStatuses({});
    setActiveId(null);
  }

  const activeItem = UAT_ITEMS.find((i) => i.id === activeId);

  return (
    <Stack gap={20} style={{ padding: 20, maxWidth: 1080 }}>
      <Stack gap={6}>
        <H1>Checklist Demo UAT — SIGAF COOTRANSHUILA</H1>
        <Text tone="secondary" size="small">
          Pruebas de aceptación de usuario · Metodología AGN 6 pasos · Acuerdo 001/2024 · 18 ago 2026
        </Text>
      </Stack>

      <Grid columns={4} gap={12}>
        <Stat value={`${completed}/${total}`} label="Ítems verificados" />
        <Stat value={`${pct}%`} label="Progreso UAT" tone={pct >= 90 ? "success" : undefined} />
        <Stat value="~60 min" label="Duración estimada demo" />
        <Stat value="97.5%" label="Cumplimiento metodológico SIGAF" tone="success" />
      </Grid>

      <UsageBar
        total={100}
        topLeftLabel="Avance checklist UAT"
        topRightLabel={`${pct}%`}
        segments={[
          { id: "done", value: pct, color: "green" },
          { id: "pending", value: 100 - pct, color: "gray" },
        ]}
      />

      <Callout tone="info" title="Instrucciones para el facilitador">
        Haga clic en cada ítem para marcarlo como completado. El estado se guarda automáticamente.
        Use un expediente de prueba dedicado. Contraseña demo: ver seed del proyecto. URL base:
        http://localhost:3000
      </Callout>

      <Grid columns={2} gap={16}>
        <Card>
          <CardHeader title="Usuarios demo" />
          <CardBody>
            <Stack gap={4}>
              {DEMO_USERS.map((u) => (
                <Text key={u.email} size="small">
                  <Text weight="semibold">{u.email}</Text>
                  {" — "}
                  {u.rol}
                </Text>
              ))}
            </Stack>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Participantes UAT (completar)" />
          <CardBody>
            <Stack gap={4}>
              <Text size="small">Facilitador TI: _________________________</Text>
              <Text size="small">Archivo Central COOTRANSHUILA: _________________________</Text>
              <Text size="small">Dependencia productora: _________________________</Text>
              <Text size="small">Fecha demo: _________________________</Text>
            </Stack>
          </CardBody>
        </Card>
      </Grid>

      {activeItem && (
        <Callout tone="success" title={`Detalle: ${activeItem.content}`}>
          <Stack gap={4}>
            <Text size="small">
              <Text weight="semibold">Ruta:</Text> {activeItem.route}
            </Text>
            <Text size="small">
              <Text weight="semibold">Rol:</Text> {activeItem.role}
            </Text>
            <Text size="small">
              <Text weight="semibold">Resultado esperado:</Text> {activeItem.expected}
            </Text>
          </Stack>
        </Callout>
      )}

      {SECTIONS.map((section) => {
        const sectionTodos = todos.filter((t) => {
          const item = UAT_ITEMS.find((i) => i.id === t.id);
          return item?.section === section;
        });
        if (!sectionTodos.length) return null;
        const sectionDone = sectionTodos.filter((t) => t.status === "completed").length;
        return (
          <Card key={section}>
            <CardHeader title={`${section} (${sectionDone}/${sectionTodos.length})`} />
            <CardBody>
              <TodoList todos={sectionTodos} onTodoClick={(todo) => toggleTodo(todo.id)} />
            </CardBody>
          </Card>
        );
      })}

      <Card>
        <CardHeader title="Acta de cierre" />
        <CardBody>
          <Stack gap={8}>
            <Text size="small">
              Resultado global UAT: ☐ Aprobado · ☐ Aprobado con observaciones · ☐ Rechazado
            </Text>
            <Text size="small">Observaciones:</Text>
            <Text size="small" tone="secondary">
              (Registrar en acta física o sistema de tickets institucional)
            </Text>
            <Row gap={8}>
              <Button onClick={resetAll}>Reiniciar checklist</Button>
            </Row>
          </Stack>
        </CardBody>
      </Card>

      <Text size="small" tone="secondary">
        SIGAF · Software Integrado de Gestión Archivística · COOTRANSHUILA · Fuente: flujos
        implementados en codebase · {new Date().toLocaleDateString("es-CO")}
      </Text>
    </Stack>
  );
}
