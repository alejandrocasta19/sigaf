import {
  PrismaClient,
  RoleCode,
  UserStatus,
  DocumentStatus,
  LoanStatus,
  TransferStatus,
  InstrumentType,
  LocationLevel,
  NotificationType,
  FinalDisposition,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PASSWORD = "Sigaf2026!";

const MODULES = [
  "users",
  "roles",
  "documents",
  "expedientes",
  "boxes",
  "folders",
  "loans",
  "transfers",
  "reports",
  "audit",
  "settings",
  "organizations",
  "dependencies",
  "search",
  "backups",
  "licenses",
  "instruments",
  "notifications",
  "jobs",
] as const;

const ACTIONS = ["create", "read", "update", "delete", "approve", "export"] as const;

const ROLES: { code: RoleCode; name: string; description: string; accessLevel: number }[] = [
  { code: "SUPER_ADMIN", name: "Super Administrador", description: "Acceso total al sistema", accessLevel: 100 },
  { code: "SYSTEM_ADMIN", name: "Administrador de Sistema", description: "Administración técnica y operativa", accessLevel: 90 },
  { code: "DOC_ADMIN", name: "Administrador Documental", description: "Gestión documental y archivo", accessLevel: 80 },
  { code: "DEPT_HEAD", name: "Jefe de Dependencia", description: "Gestión limitada de su dependencia", accessLevel: 60 },
  { code: "DEPT_WORKER", name: "Funcionario de Dependencia", description: "Carga y corrección de documentos de su dependencia", accessLevel: 40 },
  { code: "CONSULT_USER", name: "Usuario Consulta", description: "Consulta y exportación de información", accessLevel: 20 },
];

const DOC_ADMIN_MODULES = new Set([
  "documents",
  "expedientes",
  "boxes",
  "folders",
  "loans",
  "transfers",
  "instruments",
  "search",
  "reports",
  "notifications",
  "backups",
  "jobs",
  "audit",
  "settings",
]);

const DEPT_HEAD_MODULES = new Set([
  "documents",
  "expedientes",
  "loans",
  "transfers",
  "search",
  "reports",
  "notifications",
]);

const DEPT_WORKER_MODULES = new Set([
  "documents",
  "expedientes",
  "loans",
  "search",
  "notifications",
]);

const DEPT_HEAD_ACTIONS = new Set(["read", "create", "update", "approve", "export"]);
const DEPT_WORKER_ACTIONS = new Set(["read", "create", "update"]);

const CONSULT_ACTIONS = new Set(["read", "export"]);

function buildSearchText(code: string, name: string, description?: string | null): string {
  return `${code}${name}${description ?? ""}`.toLowerCase();
}

function docDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

async function clearDatabase() {
  await prisma.recycleBinItem.deleteMany();
  await prisma.job.deleteMany();
  await prisma.backupRecord.deleteMany();
  await prisma.license.deleteMany();
  await prisma.systemSetting.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.disposalProcess.deleteMany();
  await prisma.physicalInventory.deleteMany();
  await prisma.trdVersion.deleteMany();
  await prisma.archivalInstrument.deleteMany();
  await prisma.transfer.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.digitalSignature.deleteMany();
  await prisma.documentAttachment.deleteMany();
  await prisma.documentVersion.deleteMany();
  await prisma.documentWorkflowEvent.deleteMany();
  await prisma.document.deleteMany();
  await prisma.expediente.deleteMany();
  await prisma.folder.deleteMany();
  await prisma.box.deleteMany();
  await prisma.location.deleteMany();
  await prisma.documentarySubseries.deleteMany();
  await prisma.documentarySeries.deleteMany();
  await prisma.documentType.deleteMany();
  await prisma.session.deleteMany();
  await prisma.accessLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.dependency.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
}

function shouldAssignPermission(roleCode: RoleCode, module: string, action: string): boolean {
  if (roleCode === "SUPER_ADMIN" || roleCode === "SYSTEM_ADMIN") return true;

  if (roleCode === "DOC_ADMIN") {
    return DOC_ADMIN_MODULES.has(module);
  }

  if (roleCode === "DEPT_HEAD") {
    return DEPT_HEAD_MODULES.has(module) && DEPT_HEAD_ACTIONS.has(action);
  }

  if (roleCode === "DEPT_WORKER") {
    return DEPT_WORKER_MODULES.has(module) && DEPT_WORKER_ACTIONS.has(action);
  }

  if (roleCode === "CONSULT_USER") {
    // Solo módulos de consulta; no heredar read/export sobre users/settings/admin.
    const CONSULT_MODULES = new Set([
      "documents",
      "expedientes",
      "search",
      "reports",
      "loans",
      "transfers",
    ]);
    return CONSULT_MODULES.has(module) && CONSULT_ACTIONS.has(action);
  }

  return false;
}

async function main() {
  console.log("🧹 Limpiando datos existentes...");
  await clearDatabase();

  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  console.log("🏢 Creando organización COOTRANSHUILA...");
  const org = await prisma.organization.create({
    data: {
      name: "COOTRANSHUILA",
      nit: "891100234-1",
      active: true,
    },
  });

  console.log("🔐 Creando roles y permisos...");
  const roles = await Promise.all(
    ROLES.map((role) =>
      prisma.role.create({
        data: {
          code: role.code,
          name: role.name,
          description: role.description,
          accessLevel: role.accessLevel,
        },
      }),
    ),
  );
  const roleByCode = Object.fromEntries(roles.map((r) => [r.code, r])) as Record<RoleCode, (typeof roles)[0]>;

  const permissions = await Promise.all(
    MODULES.flatMap((module) =>
      ACTIONS.map((action) =>
        prisma.permission.create({
          data: {
            module,
            action,
            code: `${module}.${action}`,
            description: `${action} en ${module}`,
          },
        }),
      ),
    ),
  );

  const rolePermissionData = roles.flatMap((role) =>
    permissions
      .filter((p) => shouldAssignPermission(role.code, p.module, p.action))
      .map((p) => ({ roleId: role.id, permissionId: p.id })),
  );
  await prisma.rolePermission.createMany({ data: rolePermissionData });

  console.log("🏛️ Creando dependencias COOTRANSHUILA (códigos TRD)...");
  const dependencyDefs = [
    { code: "10", name: "Consejo de Administración", description: "Órgano de dirección" },
    { code: "20", name: "Gerencia", description: "Dirección general de la cooperativa" },
    { code: "30", name: "Coordinación Jurídica", description: "Asesoría y representación legal" },
    { code: "40", name: "Coordinación Contable", description: "Contabilidad y estados financieros" },
    { code: "50", name: "Tesorería", description: "Recaudos y pagos" },
    { code: "55", name: "Contratación", description: "Procesos de contratación y compras" },
    { code: "60", name: "Cartera", description: "Gestión de cartera y créditos" },
    { code: "70", name: "Sistemas y Marketing", description: "Tecnología y comunicaciones" },
    { code: "80", name: "Recursos Humanos", description: "Talento humano y nómina" },
    { code: "90", name: "Control Interno", description: "Auditoría y control" },
    { code: "100", name: "HSEQ", description: "Salud, seguridad, ambiente y calidad" },
    { code: "110", name: "Operativa y Transporte", description: "Operación de transporte" },
    { code: "120", name: "Administración EDS", description: "Administración estaciones de servicio" },
    { code: "130", name: "Archivo Central", description: "Gestión documental y archivo" },
  ];

  const dependencies = await Promise.all(
    dependencyDefs.map((d) =>
      prisma.dependency.create({
        data: { organizationId: org.id, ...d },
      }),
    ),
  );
  const depByCode = Object.fromEntries(dependencies.map((d) => [d.code, d]));
  // Alias legacy para documentos demo
  const depAlias: Record<string, string> = {
    GER: "20",
    JUR: "30",
    CON: "40",
    RRH: "80",
    COM: "55",
    ARC: "130",
    SIS: "70",
  };
  function dep(code: string) {
    return depByCode[depAlias[code] ?? code];
  }

  console.log("📋 Creando instrumento TRD...");
  const trdInstrument = await prisma.archivalInstrument.create({
    data: {
      organizationId: org.id,
      type: InstrumentType.TRD,
      name: "Tabla de Retención Documental COOTRANSHUILA",
      version: "1.0",
      seriesCount: 0,
      approvedAt: new Date(),
      active: true,
      notes: "TRD institucional alineada a AGN / Ley 594",
      lastUpdated: new Date(),
    },
  });

  console.log("📚 Creando series y subseries documentales (TRD)...");
  type SubDef = {
    code: string;
    name: string;
    ag?: number;
    ac?: number;
    disposition?: FinalDisposition;
    values?: Partial<{
      administrative: boolean;
      juridical: boolean;
      legal: boolean;
      fiscal: boolean;
      accounting: boolean;
      historical: boolean;
    }>;
  };
  const seriesDefs: {
    code: string;
    name: string;
    description: string;
    dep: string;
    ag: number;
    ac: number;
    disposition: FinalDisposition;
    values: {
      administrative?: boolean;
      juridical?: boolean;
      legal?: boolean;
      fiscal?: boolean;
      accounting?: boolean;
      historical?: boolean;
    };
    subseries: SubDef[];
  }[] = [
    {
      code: "01",
      name: "Acciones Constitucionales",
      description: "Tutelas, cumplimiento y acciones constitucionales",
      dep: "30",
      ag: 2,
      ac: 8,
      disposition: FinalDisposition.CONSERVATION,
      values: { juridical: true, legal: true, historical: true },
      subseries: [
        { code: "01.01", name: "Tutelas" },
        { code: "01.02", name: "Cumplimiento" },
      ],
    },
    {
      code: "02",
      name: "Actas",
      description: "Actas de órganos de dirección y comités",
      dep: "10",
      ag: 3,
      ac: 7,
      disposition: FinalDisposition.CONSERVATION,
      values: { administrative: true, historical: true },
      subseries: [
        { code: "02.01", name: "Actas Consejo de Administración" },
        { code: "02.02", name: "Actas de comités" },
      ],
    },
    {
      code: "03",
      name: "Contratos",
      description: "Contratos y convenios",
      dep: "55",
      ag: 3,
      ac: 7,
      disposition: FinalDisposition.SELECTION,
      values: { administrative: true, juridical: true, fiscal: true },
      subseries: [
        { code: "03.01", name: "Prestación de servicios" },
        { code: "03.02", name: "Obra" },
        { code: "03.03", name: "Suministro" },
      ],
    },
    {
      code: "04",
      name: "Derechos de Petición",
      description: "PQR y derechos de petición",
      dep: "30",
      ag: 2,
      ac: 3,
      disposition: FinalDisposition.ELIMINATION,
      values: { administrative: true, juridical: true },
      subseries: [
        { code: "04.01", name: "Peticiones" },
        { code: "04.02", name: "Quejas" },
        { code: "04.03", name: "Reclamos" },
      ],
    },
    {
      code: "05",
      name: "Facturación y Cuentas",
      description: "Facturas y cuentas de cobro",
      dep: "40",
      ag: 2,
      ac: 3,
      disposition: FinalDisposition.ELIMINATION,
      values: { accounting: true, fiscal: true },
      subseries: [
        { code: "05.01", name: "Facturas de proveedores" },
        { code: "05.02", name: "Cuentas de cobro" },
      ],
    },
    {
      code: "06",
      name: "Resoluciones",
      description: "Actos administrativos",
      dep: "20",
      ag: 5,
      ac: 10,
      disposition: FinalDisposition.CONSERVATION,
      values: { administrative: true, legal: true, historical: true },
      subseries: [
        { code: "06.01", name: "Resoluciones administrativas" },
        { code: "06.02", name: "Resoluciones disciplinarias" },
      ],
    },
    {
      code: "07",
      name: "Informes",
      description: "Informes de gestión, auditoría y técnicos",
      dep: "90",
      ag: 2,
      ac: 3,
      disposition: FinalDisposition.SELECTION,
      values: { administrative: true, historical: true },
      subseries: [
        { code: "07.01", name: "Informes de gestión" },
        { code: "07.02", name: "Informes de auditoría" },
      ],
    },
  ];

  // Alias series legacy → códigos TRD
  const seriesAlias: Record<string, string> = {
    CTO: "03",
    DP: "04",
    ACT: "02",
    FAC: "05",
    RES: "06",
    INF: "07",
  };
  const subAlias: Record<string, string> = {
    "CTO-PRE": "03.01",
    "CTO-OBR": "03.02",
    "CTO-SUM": "03.03",
    "DP-PET": "04.01",
    "DP-QUE": "04.02",
    "DP-REC": "04.03",
    "ACT-CON": "02.02",
    "ACT-JUN": "02.01",
    "FAC-PRO": "05.01",
    "FAC-COB": "05.02",
    "RES-ADM": "06.01",
    "RES-DIS": "06.02",
    "INF-GES": "07.01",
    "INF-AUD": "07.02",
  };

  const seriesMap: Record<string, { id: string; subseries: Record<string, { id: string }> }> = {};

  for (const s of seriesDefs) {
    const series = await prisma.documentarySeries.create({
      data: {
        organizationId: org.id,
        dependencyId: depByCode[s.dep].id,
        instrumentId: trdInstrument.id,
        code: s.code,
        name: s.name,
        description: s.description,
        retentionYears: s.ag + s.ac,
        retentionManagementYears: s.ag,
        retentionCentralYears: s.ac,
        finalDisposition: s.disposition,
        valueAdministrative: !!s.values.administrative,
        valueJuridical: !!s.values.juridical,
        valueLegal: !!s.values.legal,
        valueFiscal: !!s.values.fiscal,
        valueAccounting: !!s.values.accounting,
        valueHistorical: !!s.values.historical,
        procedure: `Retención AG ${s.ag} años · AC ${s.ac} años · ${s.disposition}`,
      },
    });
    const subseries: Record<string, { id: string }> = {};
    for (const sub of s.subseries) {
      const created = await prisma.documentarySubseries.create({
        data: {
          seriesId: series.id,
          code: sub.code,
          name: sub.name,
          retentionManagementYears: sub.ag ?? s.ag,
          retentionCentralYears: sub.ac ?? s.ac,
          finalDisposition: sub.disposition ?? s.disposition,
          valueAdministrative: !!(sub.values?.administrative ?? s.values.administrative),
          valueJuridical: !!(sub.values?.juridical ?? s.values.juridical),
          valueLegal: !!(sub.values?.legal ?? s.values.legal),
          valueFiscal: !!(sub.values?.fiscal ?? s.values.fiscal),
          valueAccounting: !!(sub.values?.accounting ?? s.values.accounting),
          valueHistorical: !!(sub.values?.historical ?? s.values.historical),
        },
      });
      subseries[sub.code] = { id: created.id };
    }
    seriesMap[s.code] = { id: series.id, subseries };
  }

  // Exponer también por alias legacy
  for (const [legacy, code] of Object.entries(seriesAlias)) {
    seriesMap[legacy] = seriesMap[code];
  }
  for (const [legacySub, code] of Object.entries(subAlias)) {
    const seriesCode = code.split(".")[0];
    if (!seriesMap[legacySub.split("-")[0]]) {
      // noop
    }
    const parent = seriesMap[seriesCode];
    if (parent) {
      // attach alias key on seriesMap via synthetic lookup helper below
      parent.subseries[legacySub] = parent.subseries[code];
    }
  }

  await prisma.archivalInstrument.update({
    where: { id: trdInstrument.id },
    data: { seriesCount: seriesDefs.length },
  });

  await prisma.archivalInstrument.createMany({
    data: [
      {
        organizationId: org.id,
        type: InstrumentType.TVD,
        name: "Tabla de Valoración Documental",
        version: "1.0",
        seriesCount: seriesDefs.length,
        active: true,
      },
      {
        organizationId: org.id,
        type: InstrumentType.CCD,
        name: "Cuadro de Clasificación Documental",
        version: "1.0",
        seriesCount: seriesDefs.length,
        active: true,
      },
      {
        organizationId: org.id,
        type: InstrumentType.PGD,
        name: "Programa de Gestión Documental",
        version: "1.0",
        seriesCount: 0,
        active: true,
      },
    ],
  });

  console.log("📄 Creando tipos documentales...");
  const docTypeDefs = [
    { code: "PDF", name: "Documento PDF", category: "FORMAT" },
    { code: "IMG", name: "Imagen Escaneada", category: "FORMAT" },
    { code: "DOC", name: "Documento Word", category: "FORMAT" },
    { code: "XLS", name: "Hoja de Cálculo", category: "FORMAT" },
    { code: "OFI", name: "Oficio", category: "TYPOLOGY" },
    { code: "MEM", name: "Memorando", category: "TYPOLOGY" },
    { code: "CER", name: "Certificación", category: "TYPOLOGY" },
    { code: "ACTA", name: "Acta", category: "TYPOLOGY" },
    { code: "CTR", name: "Contrato", category: "TYPOLOGY" },
  ];

  const docTypes = await Promise.all(
    docTypeDefs.map((dt) =>
      prisma.documentType.create({
        data: {
          organizationId: org.id,
          code: dt.code,
          name: dt.name,
          category: dt.category,
        },
      }),
    ),
  );
  const docTypeByCode = Object.fromEntries(docTypes.map((dt) => [dt.code, dt]));

  console.log("👤 Creando usuarios...");
  const deptHead = await prisma.user.create({
    data: {
      organizationId: org.id,
      roleId: roleByCode.DEPT_HEAD.id,
      dependencyId: dep("JUR").id,
      email: "jefe@sigaf.local",
      passwordHash,
      firstName: "Juan",
      lastName: "Pérez",
      status: UserStatus.ACTIVE,
      lastLoginAt: new Date(),
    },
  });

  const users = await Promise.all([
    prisma.user.create({
      data: {
        organizationId: org.id,
        roleId: roleByCode.SUPER_ADMIN.id,
        email: "super@sigaf.local",
        passwordHash,
        firstName: "Super",
        lastName: "Administrador",
        status: UserStatus.ACTIVE,
        lastLoginAt: new Date(),
      },
    }),
    prisma.user.create({
      data: {
        organizationId: org.id,
        roleId: roleByCode.SYSTEM_ADMIN.id,
        email: "sistema@sigaf.local",
        passwordHash,
        firstName: "Roberto",
        lastName: "Vargas",
        status: UserStatus.ACTIVE,
        lastLoginAt: new Date(),
      },
    }),
    prisma.user.create({
      data: {
        organizationId: org.id,
        roleId: roleByCode.DOC_ADMIN.id,
        dependencyId: dep("ARC").id,
        email: "documental@sigaf.local",
        passwordHash,
        firstName: "Carla",
        lastName: "Méndez",
        status: UserStatus.ACTIVE,
        lastLoginAt: new Date(),
      },
    }),
    prisma.user.create({
      data: {
        organizationId: org.id,
        roleId: roleByCode.DEPT_WORKER.id,
        dependencyId: dep("JUR").id,
        managerId: deptHead.id,
        email: "funcionario@sigaf.local",
        passwordHash,
        firstName: "Ana",
        lastName: "Ruiz",
        status: UserStatus.ACTIVE,
        lastLoginAt: new Date(),
      },
    }),
    prisma.user.create({
      data: {
        organizationId: org.id,
        roleId: roleByCode.DEPT_WORKER.id,
        dependencyId: dep("JUR").id,
        managerId: deptHead.id,
        email: "funcionario2@sigaf.local",
        passwordHash,
        firstName: "Diego",
        lastName: "Castro",
        status: UserStatus.ACTIVE,
      },
    }),
    prisma.user.create({
      data: {
        organizationId: org.id,
        roleId: roleByCode.CONSULT_USER.id,
        dependencyId: dep("GER").id,
        email: "consulta@sigaf.local",
        passwordHash,
        firstName: "Laura",
        lastName: "Gómez",
        status: UserStatus.ACTIVE,
      },
    }),
  ]);
  const [superUser, systemUser, docAdmin, deptWorker, deptWorker2, consultUser] = users;

  console.log("📍 Creando jerarquía de ubicaciones (Edificio→Piso→Sala→Estantería→Nivel)...");
  const building = await prisma.location.create({
    data: {
      organizationId: org.id,
      level: LocationLevel.BUILDING,
      code: "EDI-01",
      name: "Edificio Archivo Central",
    },
  });
  const floor = await prisma.location.create({
    data: {
      organizationId: org.id,
      parentId: building.id,
      level: LocationLevel.FLOOR,
      code: "PISO-1",
      name: "Piso 1",
    },
  });
  const room = await prisma.location.create({
    data: {
      organizationId: org.id,
      parentId: floor.id,
      level: LocationLevel.ROOM,
      code: "SAL-101",
      name: "Sala 101",
    },
  });
  const shelf = await prisma.location.create({
    data: {
      organizationId: org.id,
      parentId: room.id,
      level: LocationLevel.SHELF,
      code: "EST-01",
      name: "Estantería 1",
    },
  });
  await prisma.location.create({
    data: {
      organizationId: org.id,
      parentId: shelf.id,
      level: LocationLevel.LEVEL,
      code: "NIV-01",
      name: "Nivel 1",
    },
  });

  console.log("📦 Creando cajas y carpetas...");
  const boxes = await Promise.all(
    ["CAJ-001", "CAJ-002", "CAJ-003", "CAJ-004", "CAJ-005"].map((code, i) =>
      prisma.box.create({
        data: {
          organizationId: org.id,
          locationId: room.id,
          code,
          qrCode: `QR-${code}`,
          capacity: 50,
          currentCount: i + 3,
          status: i === 4 ? "FULL" : "AVAILABLE",
        },
      }),
    ),
  );

  const folders = await Promise.all(
    [
      { code: "CAR-001", name: "Contratos 2024", color: "#2563EB", boxId: boxes[0].id },
      { code: "CAR-002", name: "Contratos 2025", color: "#059669", boxId: boxes[0].id },
      { code: "CAR-003", name: "Derechos de Petición", color: "#D97706", boxId: boxes[1].id },
      { code: "CAR-004", name: "Actas Comité", color: "#7C3AED", boxId: boxes[1].id },
      { code: "CAR-005", name: "Facturación Q1", color: "#DC2626", boxId: boxes[2].id },
      { code: "CAR-006", name: "Resoluciones 2023", color: "#0891B2", boxId: boxes[2].id },
      { code: "CAR-007", name: "Informes Gestión", color: "#4F46E5", boxId: boxes[3].id },
      { code: "CAR-008", name: "Expedientes Jurídica", color: "#BE185D", boxId: boxes[3].id },
    ].map((f) =>
      prisma.folder.create({
        data: { organizationId: org.id, ...f },
      }),
    ),
  );

  console.log("📁 Creando expedientes...");
  const expedienteDefs = [
    { code: "EXP-2021-001", name: "Contratación servicios TI 2021", dep: "COM", status: DocumentStatus.CLOSED, year: 2021 },
    { code: "EXP-2021-002", name: "Proceso disciplinario 2021", dep: "JUR", status: DocumentStatus.CLOSED, year: 2021 },
    { code: "EXP-2022-001", name: "Auditoría interna 2022", dep: "CON", status: DocumentStatus.CLOSED, year: 2022 },
    { code: "EXP-2022-002", name: "Contratación obra sede", dep: "COM", status: DocumentStatus.ACTIVE, year: 2022 },
    { code: "EXP-2023-001", name: "Plan de desarrollo 2023", dep: "GER", status: DocumentStatus.ACTIVE, year: 2023 },
    { code: "EXP-2023-002", name: "Proceso selección personal", dep: "RRH", status: DocumentStatus.CLOSED, year: 2023 },
    { code: "EXP-2023-003", name: "Reorganización archivo", dep: "ARC", status: DocumentStatus.ACTIVE, year: 2023 },
    { code: "EXP-2024-001", name: "Modernización SIGAF", dep: "SIS", status: DocumentStatus.ACTIVE, year: 2024 },
    { code: "EXP-2024-002", name: "PQR ciudadanía 2024", dep: "JUR", status: DocumentStatus.UNDER_REVIEW, year: 2024 },
    { code: "EXP-2024-003", name: "Presupuesto anual 2024", dep: "CON", status: DocumentStatus.CLOSED, year: 2024 },
    { code: "EXP-2025-001", name: "Contratos vigentes 2025", dep: "COM", status: DocumentStatus.ACTIVE, year: 2025 },
    { code: "EXP-2025-002", name: "Capacitación documental", dep: "ARC", status: DocumentStatus.ACTIVE, year: 2025 },
    { code: "EXP-2025-003", name: "Evaluación desempeño", dep: "RRH", status: DocumentStatus.PENDING, year: 2025 },
    { code: "EXP-2026-001", name: "Implementación TRD 2026", dep: "ARC", status: DocumentStatus.ACTIVE, year: 2026 },
    { code: "EXP-2026-002", name: "Seguridad información", dep: "SIS", status: DocumentStatus.UNDER_REVIEW, year: 2026 },
  ];

  const expedientes = await Promise.all(
    expedienteDefs.map((e) =>
      prisma.expediente.create({
        data: {
          organizationId: org.id,
          dependencyId: dep(e.dep).id,
          responsibleId: e.dep === "JUR" ? deptHead.id : docAdmin.id,
          code: e.code,
          name: e.name,
          description: `Expediente demo ${e.name}`,
          status: e.status,
          openedAt: docDate(e.year, 1, 15),
          closedAt: e.status === DocumentStatus.CLOSED ? docDate(e.year, 12, 20) : null,
        },
      }),
    ),
  );
  const expByCode = Object.fromEntries(expedientes.map((e) => [e.code, e]));

  console.log("📄 Creando documentos...");
  const documentDefs: {
    code: string;
    name: string;
    description: string;
    dep: string;
    series: string;
    subseries: string;
    docType: string;
    folderIdx: number;
    expCode?: string;
    status: DocumentStatus;
    year: number;
    month: number;
    folios: number;
  }[] = [
    { code: "DOC-2021-001", name: "Contrato mantenimiento 2021", description: "Contrato anual de mantenimiento", dep: "COM", series: "CTO", subseries: "CTO-PRE", docType: "PDF", folderIdx: 0, expCode: "EXP-2021-001", status: DocumentStatus.CLOSED, year: 2021, month: 3, folios: 12 },
    { code: "DOC-2021-002", name: "Acta comité contratación", description: "Acta de apertura de proceso", dep: "COM", series: "ACT", subseries: "ACT-CON", docType: "PDF", folderIdx: 3, expCode: "EXP-2021-001", status: DocumentStatus.ACTIVE, year: 2021, month: 2, folios: 5 },
    { code: "DOC-2021-003", name: "Resolución nombramiento", description: "Resolución de nombramiento gerente", dep: "GER", series: "RES", subseries: "RES-ADM", docType: "OFI", folderIdx: 6, status: DocumentStatus.ACTIVE, year: 2021, month: 6, folios: 3 },
    { code: "DOC-2022-001", name: "Informe auditoría Q1", description: "Informe trimestral de auditoría", dep: "CON", series: "INF", subseries: "INF-AUD", docType: "PDF", folderIdx: 6, expCode: "EXP-2022-001", status: DocumentStatus.CLOSED, year: 2022, month: 4, folios: 28 },
    { code: "DOC-2022-002", name: "Contrato obra sede", description: "Contrato de construcción sede principal", dep: "COM", series: "CTO", subseries: "CTO-OBR", docType: "PDF", folderIdx: 0, expCode: "EXP-2022-002", status: DocumentStatus.ACTIVE, year: 2022, month: 8, folios: 45 },
    { code: "DOC-2022-003", name: "Derecho de petición ciudadano", description: "Solicitud de información pública", dep: "JUR", series: "DP", subseries: "DP-PET", docType: "PDF", folderIdx: 2, status: DocumentStatus.ACTIVE, year: 2022, month: 11, folios: 4 },
    { code: "DOC-2023-001", name: "Plan estratégico 2023", description: "Documento de planificación institucional", dep: "GER", series: "INF", subseries: "INF-GES", docType: "DOC", folderIdx: 6, expCode: "EXP-2023-001", status: DocumentStatus.ACTIVE, year: 2023, month: 1, folios: 62 },
    { code: "DOC-2023-002", name: "Acta junta directiva", description: "Acta ordinaria enero 2023", dep: "GER", series: "ACT", subseries: "ACT-JUN", docType: "PDF", folderIdx: 3, status: DocumentStatus.ACTIVE, year: 2023, month: 1, folios: 8 },
    { code: "DOC-2023-003", name: "Factura proveedor ABC", description: "Factura suministros oficina", dep: "CON", series: "FAC", subseries: "FAC-PRO", docType: "PDF", folderIdx: 4, status: DocumentStatus.ACTIVE, year: 2023, month: 5, folios: 2 },
    { code: "DOC-2023-004", name: "Resolución archivo TRD", description: "Aprobación tabla de retención", dep: "ARC", series: "RES", subseries: "RES-ADM", docType: "OFI", folderIdx: 5, expCode: "EXP-2023-003", status: DocumentStatus.ACTIVE, year: 2023, month: 9, folios: 15 },
    { code: "DOC-2023-005", name: "Certificación laboral", description: "Certificación tiempo de servicio", dep: "RRH", series: "RES", subseries: "RES-ADM", docType: "CER", folderIdx: 7, status: DocumentStatus.ACTIVE, year: 2023, month: 7, folios: 1 },
    { code: "DOC-2024-001", name: "Memorando modernización", description: "Lineamientos proyecto SIGAF v2", dep: "SIS", series: "INF", subseries: "INF-GES", docType: "MEM", folderIdx: 6, expCode: "EXP-2024-001", status: DocumentStatus.UNDER_REVIEW, year: 2024, month: 2, folios: 6 },
    { code: "DOC-2024-002", name: "Queja ciudadana transporte", description: "Queja por servicio de transporte", dep: "JUR", series: "DP", subseries: "DP-QUE", docType: "PDF", folderIdx: 2, expCode: "EXP-2024-002", status: DocumentStatus.UNDER_REVIEW, year: 2024, month: 3, folios: 3 },
    { code: "DOC-2024-003", name: "Contrato suministro papelería", description: "Contrato anual suministros", dep: "COM", series: "CTO", subseries: "CTO-SUM", docType: "PDF", folderIdx: 1, expCode: "EXP-2025-001", status: DocumentStatus.ACTIVE, year: 2024, month: 11, folios: 18 },
    { code: "DOC-2024-004", name: "Informe presupuesto ejecutado", description: "Ejecución presupuestal 2024", dep: "CON", series: "INF", subseries: "INF-GES", docType: "XLS", folderIdx: 4, expCode: "EXP-2024-003", status: DocumentStatus.CLOSED, year: 2024, month: 12, folios: 22 },
    { code: "DOC-2024-005", name: "Reclamo proveedor", description: "Reclamo por incumplimiento contractual", dep: "COM", series: "DP", subseries: "DP-REC", docType: "PDF", folderIdx: 2, status: DocumentStatus.PENDING, year: 2024, month: 6, folios: 5 },
    { code: "DOC-2024-006", name: "Acta comité archivo", description: "Acta revisión inventario", dep: "ARC", series: "ACT", subseries: "ACT-CON", docType: "PDF", folderIdx: 3, status: DocumentStatus.ACTIVE, year: 2024, month: 8, folios: 7 },
    { code: "DOC-2025-001", name: "Contrato consultoría legal", description: "Contrato asesoría jurídica externa", dep: "JUR", series: "CTO", subseries: "CTO-PRE", docType: "PDF", folderIdx: 7, expCode: "EXP-2025-001", status: DocumentStatus.ACTIVE, year: 2025, month: 1, folios: 20 },
    { code: "DOC-2025-002", name: "Derecho petición acceso datos", description: "Solicitud acceso información personal", dep: "JUR", series: "DP", subseries: "DP-PET", docType: "PDF", folderIdx: 2, expCode: "EXP-2024-002", status: DocumentStatus.ACTIVE, year: 2025, month: 2, folios: 4 },
    { code: "DOC-2025-003", name: "Cuenta de cobro honorarios", description: "Cuenta de cobro febrero 2025", dep: "CON", series: "FAC", subseries: "FAC-COB", docType: "PDF", folderIdx: 4, status: DocumentStatus.ACTIVE, year: 2025, month: 2, folios: 2 },
    { code: "DOC-2025-004", name: "Resolución sanción disciplinaria", description: "Resolución proceso disciplinario", dep: "RRH", series: "RES", subseries: "RES-DIS", docType: "OFI", folderIdx: 5, expCode: "EXP-2025-003", status: DocumentStatus.UNDER_REVIEW, year: 2025, month: 4, folios: 10 },
    { code: "DOC-2025-005", name: "Informe capacitación TRD", description: "Informe taller tabla retención", dep: "ARC", series: "INF", subseries: "INF-GES", docType: "PDF", folderIdx: 6, expCode: "EXP-2025-002", status: DocumentStatus.ACTIVE, year: 2025, month: 5, folios: 14 },
    { code: "DOC-2025-006", name: "Contrato hosting cloud", description: "Contrato servicios nube", dep: "SIS", series: "CTO", subseries: "CTO-PRE", docType: "PDF", folderIdx: 1, expCode: "EXP-2024-001", status: DocumentStatus.ACTIVE, year: 2025, month: 3, folios: 16 },
    { code: "DOC-2025-007", name: "Acta evaluación desempeño", description: "Acta comité evaluación", dep: "RRH", series: "ACT", subseries: "ACT-CON", docType: "PDF", folderIdx: 3, expCode: "EXP-2025-003", status: DocumentStatus.PENDING, year: 2025, month: 6, folios: 9 },
    { code: "DOC-2025-008", name: "Factura licencias software", description: "Factura renovación licencias", dep: "SIS", series: "FAC", subseries: "FAC-PRO", docType: "PDF", folderIdx: 4, status: DocumentStatus.ACTIVE, year: 2025, month: 7, folios: 2 },
    { code: "DOC-2026-001", name: "Política gestión documental", description: "Política institucional de archivo", dep: "ARC", series: "RES", subseries: "RES-ADM", docType: "DOC", folderIdx: 5, expCode: "EXP-2026-001", status: DocumentStatus.ACTIVE, year: 2026, month: 1, folios: 35 },
    { code: "DOC-2026-002", name: "Plan seguridad información", description: "Plan anual de seguridad TI", dep: "SIS", series: "INF", subseries: "INF-GES", docType: "PDF", folderIdx: 6, expCode: "EXP-2026-002", status: DocumentStatus.UNDER_REVIEW, year: 2026, month: 1, folios: 40 },
    { code: "DOC-2026-003", name: "Memorando préstamo documental", description: "Solicitud préstamo para revisión", dep: "JUR", series: "DP", subseries: "DP-PET", docType: "MEM", folderIdx: 7, status: DocumentStatus.ON_LOAN, year: 2026, month: 2, folios: 2 },
    { code: "DOC-2026-004", name: "Certificación existencia expediente", description: "Certificación para proceso judicial", dep: "JUR", series: "RES", subseries: "RES-ADM", docType: "CER", folderIdx: 7, status: DocumentStatus.ACTIVE, year: 2026, month: 2, folios: 1 },
    { code: "DOC-2025-009", name: "Documento vencido retención", description: "Documento con retención cumplida", dep: "CON", series: "FAC", subseries: "FAC-PRO", docType: "IMG", folderIdx: 4, status: DocumentStatus.EXPIRED, year: 2025, month: 1, folios: 1 },
    { code: "DOC-2024-007", name: "Borrador contrato pendiente", description: "Borrador en revisión jurídica", dep: "COM", series: "CTO", subseries: "CTO-SUM", docType: "DOC", folderIdx: 1, status: DocumentStatus.PENDING, year: 2024, month: 9, folios: 8 },
  ];

  const documents = await Promise.all(
    documentDefs.map((d) => {
      const description = d.description;
      return prisma.document.create({
        data: {
          organizationId: org.id,
          dependencyId: dep(d.dep).id,
          expedienteId: d.expCode ? expByCode[d.expCode].id : null,
          seriesId: seriesMap[d.series].id,
          subseriesId: seriesMap[d.series].subseries[d.subseries].id,
          documentTypeId: docTypeByCode[d.docType].id,
          folderId: folders[d.folderIdx].id,
          responsibleId: d.dep === "JUR" ? deptHead.id : docAdmin.id,
          code: d.code,
          qrCode: `QR-${d.code}`,
          barcode: `BC-${d.code}`,
          name: d.name,
          description,
          status: d.status,
          archivalPhase:
            d.year <= 2022
              ? "HISTORICAL"
              : d.year <= 2024
                ? "CENTRAL"
                : "MANAGEMENT",
          folioCount: d.folios,
          documentDate: docDate(d.year, d.month, 10),
          searchText: buildSearchText(d.code, d.name, description),
          filePath: `/storage/${org.id}/${d.code}.pdf`,
        },
      });
    }),
  );
  const docByCode = Object.fromEntries(documents.map((d) => [d.code, d]));

  const now = new Date();

  console.log("📋 Creando documentos en flujo de aprobación...");

  // PDF mínimo válido para demo de vista previa del Jefe
  const { writeFile, mkdir } = await import("fs/promises");
  const pathMod = await import("path");
  const uploadRoot = pathMod.resolve(process.env.UPLOAD_DIR || "./uploads");
  const versionDir = pathMod.join(uploadRoot, org.id, "versions");
  await mkdir(versionDir, { recursive: true });

  const minimalPdf = Buffer.from(
    `%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj
4 0 obj<< /Length 68 >>stream
BT /F1 18 Tf 72 720 Td (SIGAF - Documento para revision del Jefe) Tj ET
endstream
endobj
5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000385 00000 n 
trailer<< /Size 6 /Root 1 0 R >>
startxref
462
%%EOF`,
  );

  async function saveDemoPdf(code: string) {
    const filename = `${code}-v1.pdf`;
    const absolute = pathMod.join(versionDir, filename);
    await writeFile(absolute, minimalPdf);
    return `${org.id}/versions/${filename}`.replace(/\\/g, "/");
  }

  const wfPaths = await Promise.all([
    saveDemoPdf("DOC-2026-010"),
    saveDemoPdf("DOC-2026-011"),
    saveDemoPdf("DOC-2026-012"),
  ]);

  const workflowDocs = await Promise.all([
    prisma.document.create({
      data: {
        organizationId: org.id,
        dependencyId: dep("JUR").id,
        seriesId: seriesMap.DP.id,
        subseriesId: seriesMap.DP.subseries["DP-PET"].id,
        documentTypeId: docTypeByCode.MEM.id,
        folderId: folders[7].id,
        responsibleId: deptWorker.id,
        submittedById: deptWorker.id,
        code: "DOC-2026-010",
        qrCode: "QR-DOC-2026-010",
        name: "Memorando respuesta PQR ciudadano",
        description: "Proyecto de respuesta cargado por funcionario para revisión del jefe",
        status: DocumentStatus.PENDING_REVIEW,
        folioCount: 3,
        documentDate: now,
        submittedAt: now,
        filePath: wfPaths[0],
        searchText: buildSearchText("DOC-2026-010", "Memorando respuesta PQR ciudadano"),
      },
    }),
    prisma.document.create({
      data: {
        organizationId: org.id,
        dependencyId: dep("JUR").id,
        seriesId: seriesMap.CTO.id,
        subseriesId: seriesMap.CTO.subseries["CTO-PRE"].id,
        documentTypeId: docTypeByCode.PDF.id,
        folderId: folders[7].id,
        responsibleId: deptWorker2.id,
        submittedById: deptWorker2.id,
        code: "DOC-2026-011",
        qrCode: "QR-DOC-2026-011",
        name: "Minuta contrato asesoría externa",
        description: "Documento aprobado por dependencia, pendiente de validación archivística",
        status: DocumentStatus.IN_REVIEW_ARCHIVE,
        folioCount: 12,
        documentDate: now,
        submittedAt: new Date(now.getTime() - 2 * 86400000),
        approvedDeptAt: new Date(now.getTime() - 86400000),
        filePath: wfPaths[1],
        searchText: buildSearchText("DOC-2026-011", "Minuta contrato asesoría externa"),
      },
    }),
    prisma.document.create({
      data: {
        organizationId: org.id,
        dependencyId: dep("JUR").id,
        seriesId: seriesMap.DP.id,
        subseriesId: seriesMap.DP.subseries["DP-QUE"].id,
        documentTypeId: docTypeByCode.PDF.id,
        folderId: folders[2].id,
        responsibleId: deptWorker.id,
        submittedById: deptWorker.id,
        code: "DOC-2026-012",
        qrCode: "QR-DOC-2026-012",
        name: "Queja ciudadana — borrador corregible",
        description: "Rechazado por el jefe por falta de anexos",
        status: DocumentStatus.REJECTED_DEPT,
        folioCount: 2,
        workflowNotes: "Falta anexar copia de la queja original y radicado de entrada.",
        documentDate: now,
        submittedAt: new Date(now.getTime() - 3 * 86400000),
        filePath: wfPaths[2],
        searchText: buildSearchText("DOC-2026-012", "Queja ciudadana — borrador corregible"),
      },
    }),
  ]);

  await Promise.all(
    workflowDocs.map((doc, i) =>
      prisma.documentVersion.create({
        data: {
          documentId: doc.id,
          version: 1,
          filePath: wfPaths[i],
          changeNote: "Archivo inicial para revisión",
          createdById: doc.submittedById,
        },
      })
    )
  );

  await prisma.documentWorkflowEvent.createMany({
    data: [
      {
        documentId: workflowDocs[0].id,
        actorId: deptWorker.id,
        action: "SUBMIT",
        toStatus: DocumentStatus.PENDING_REVIEW,
        observations: "Documento cargado para revisión de dependencia",
      },
      {
        documentId: workflowDocs[1].id,
        actorId: deptWorker2.id,
        action: "SUBMIT",
        toStatus: DocumentStatus.PENDING_REVIEW,
        observations: "Documento cargado para revisión de dependencia",
      },
      {
        documentId: workflowDocs[1].id,
        actorId: deptHead.id,
        action: "APPROVE_DEPT",
        fromStatus: DocumentStatus.PENDING_REVIEW,
        toStatus: DocumentStatus.APPROVED_DEPT,
        observations: "Clasificación y metadatos correctos",
      },
      {
        documentId: workflowDocs[1].id,
        actorId: deptHead.id,
        action: "COMMENT",
        fromStatus: DocumentStatus.APPROVED_DEPT,
        toStatus: DocumentStatus.IN_REVIEW_ARCHIVE,
        observations: "Enviado a revisión archivística",
      },
      {
        documentId: workflowDocs[2].id,
        actorId: deptWorker.id,
        action: "SUBMIT",
        toStatus: DocumentStatus.PENDING_REVIEW,
      },
      {
        documentId: workflowDocs[2].id,
        actorId: deptHead.id,
        action: "REJECT_DEPT",
        fromStatus: DocumentStatus.PENDING_REVIEW,
        toStatus: DocumentStatus.REJECTED_DEPT,
        observations: "Falta anexar copia de la queja original y radicado de entrada.",
      },
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        organizationId: org.id,
        userId: deptHead.id,
        type: NotificationType.WARNING,
        title: "Documento pendiente de revisión",
        message: `${workflowDocs[0].code} · ${workflowDocs[0].name}`,
        link: `/documents/${workflowDocs[0].id}`,
      },
      {
        organizationId: org.id,
        userId: docAdmin.id,
        type: NotificationType.INFO,
        title: "Revisión archivística pendiente",
        message: `${workflowDocs[1].code} · ${workflowDocs[1].name}`,
        link: `/documents/${workflowDocs[1].id}`,
      },
      {
        organizationId: org.id,
        userId: deptWorker.id,
        type: NotificationType.ERROR,
        title: "Documento rechazado por dependencia",
        message: `${workflowDocs[2].code}: Falta anexar copia de la queja original`,
        link: `/documents/${workflowDocs[2].id}`,
      },
    ],
  });

  console.log("🔄 Creando préstamos (plazo 24h desde aprobación)...");
  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const approvedRecent = new Date(now.getTime() - 2 * 60 * 60 * 1000); // hace 2h
  const dueIn22h = new Date(approvedRecent.getTime() + 24 * 60 * 60 * 1000);
  const approvedYesterday = new Date(now.getTime() - 30 * 60 * 60 * 1000); // hace 30h
  const dueYesterday = new Date(approvedYesterday.getTime() + 24 * 60 * 60 * 1000);

  await prisma.loan.createMany({
    data: [
      {
        organizationId: org.id,
        documentId: docByCode["DOC-2026-003"].id,
        requesterId: deptHead.id,
        approverId: docAdmin.id,
        code: "PRE-2026-001",
        status: LoanStatus.ACTIVE,
        requestedAt: twoWeeksAgo,
        approvedAt: approvedRecent,
        dueDate: dueIn22h,
        notes: "Préstamo activo — plazo máximo 24 horas desde entrega",
      },
      {
        organizationId: org.id,
        documentId: docByCode["DOC-2025-001"].id,
        requesterId: consultUser.id,
        approverId: docAdmin.id,
        code: "PRE-2025-001",
        status: LoanStatus.ACTIVE,
        requestedAt: new Date(now.getTime() - 5 * 86400000),
        approvedAt: approvedRecent,
        dueDate: dueIn22h,
        notes: "Préstamo activo para consulta (24h)",
      },
      {
        organizationId: org.id,
        documentId: docByCode["DOC-2024-002"].id,
        requesterId: deptHead.id,
        approverId: docAdmin.id,
        code: "PRE-2024-001",
        status: LoanStatus.RETURNED,
        requestedAt: docDate(2024, 5, 1),
        approvedAt: docDate(2024, 5, 2),
        dueDate: new Date(docDate(2024, 5, 2).getTime() + 24 * 60 * 60 * 1000),
        returnedAt: docDate(2024, 5, 2),
        notes: "Préstamo devuelto dentro de las 24 horas",
      },
      {
        organizationId: org.id,
        documentId: docByCode["DOC-2023-003"].id,
        requesterId: systemUser.id,
        code: "PRE-2025-002",
        status: LoanStatus.REQUESTED,
        requestedAt: now,
        notes: "Solicitud pendiente de aprobación",
      },
      {
        organizationId: org.id,
        documentId: docByCode["DOC-2022-003"].id,
        requesterId: consultUser.id,
        approverId: docAdmin.id,
        code: "PRE-2023-001",
        status: LoanStatus.OVERDUE,
        requestedAt: approvedYesterday,
        approvedAt: approvedYesterday,
        dueDate: dueYesterday,
        notes: "Préstamo vencido (superó las 24 horas)",
      },
    ],
  });

  console.log("🔀 Creando transferencias...");
  await prisma.transfer.createMany({
    data: [
      {
        organizationId: org.id,
        code: "TRF-2025-001",
        title: "Transferencia primaria Jurídica → Archivo",
        fromDependency: dep("JUR").name,
        toDependency: dep("ARC").name,
        status: TransferStatus.COMPLETED,
        scheduledAt: docDate(2025, 6, 1),
        completedAt: docDate(2025, 6, 15),
        notes: "Transferencia documentos cerrados 2024",
      },
      {
        organizationId: org.id,
        code: "TRF-2025-002",
        title: "Transferencia Contabilidad → Archivo Central",
        fromDependency: dep("CON").name,
        toDependency: dep("ARC").name,
        status: TransferStatus.IN_PROGRESS,
        scheduledAt: docDate(2025, 11, 1),
        notes: "En proceso de inventario",
      },
      {
        organizationId: org.id,
        code: "TRF-2026-001",
        title: "Transferencia Compras pendiente",
        fromDependency: dep("COM").name,
        toDependency: dep("ARC").name,
        status: TransferStatus.PENDING,
        scheduledAt: docDate(2026, 3, 1),
        notes: "Programada para marzo 2026",
      },
      {
        organizationId: org.id,
        code: "TRF-2024-001",
        title: "Transferencia RRHH documentación personal",
        fromDependency: dep("RRH").name,
        toDependency: dep("ARC").name,
        status: TransferStatus.APPROVED,
        scheduledAt: docDate(2026, 4, 1),
        notes: "Aprobada, pendiente ejecución",
      },
    ],
  });

  console.log("📋 Complementando instrumentos (POLICY)...");
  await prisma.archivalInstrument.create({
    data: {
      organizationId: org.id,
      type: InstrumentType.POLICY,
      name: "Política de Gestión Documental COOTRANSHUILA",
      version: "1.0",
      seriesCount: 0,
      active: true,
      lastUpdated: new Date(),
    },
  });

  console.log("🗑️ Creando proceso demo de eliminación...");
  await prisma.disposalProcess.create({
    data: {
      organizationId: org.id,
      code: "ELIM-2026-001",
      title: "Eliminación series de facturación con retención cumplida",
      status: "INVENTORY_PUBLISHED",
      inventoryNote: "Inventario publicado según TRD serie 05 — Facturación",
      publishedAt: new Date(),
      createdById: docAdmin.id,
      documentIds: [],
    },
  });

  console.log("📝 Creando registros de auditoría...");
  await prisma.auditLog.createMany({
    data: [
      { organizationId: org.id, userId: superUser.id, action: "login", module: "auth", entityType: "User", entityId: superUser.id, ipAddress: "192.168.1.10" },
      { organizationId: org.id, userId: docAdmin.id, action: "create", module: "documents", entityType: "Document", entityId: documents[0].id, changes: { code: documents[0].code } },
      { organizationId: org.id, userId: deptHead.id, action: "read", module: "expedientes", entityType: "Expediente", entityId: expedientes[8].id },
      { organizationId: org.id, userId: docAdmin.id, action: "approve", module: "loans", entityType: "Loan", changes: { code: "PRE-2026-001" } },
      { organizationId: org.id, userId: systemUser.id, action: "update", module: "settings", entityType: "SystemSetting", changes: { key: "app.version" } },
      { organizationId: org.id, userId: superUser.id, action: "export", module: "reports", entityType: "Report", changes: { type: "inventory" } },
      { organizationId: org.id, userId: consultUser.id, action: "read", module: "search", entityType: "Document", changes: { query: "contrato" } },
      { organizationId: org.id, userId: docAdmin.id, action: "create", module: "boxes", entityType: "Box", changes: { code: "CAJ-001" } },
    ],
  });

  console.log("🔔 Creando notificaciones...");
  await prisma.notification.createMany({
    data: [
      {
        organizationId: org.id,
        userId: docAdmin.id,
        type: NotificationType.WARNING,
        title: "Préstamo por vencer",
        message: "El préstamo PRE-2026-001 vence en 3 días",
        link: "/loans/PRE-2026-001",
      },
      {
        organizationId: org.id,
        userId: deptHead.id,
        type: NotificationType.INFO,
        title: "Préstamo aprobado",
        message: "Su solicitud de préstamo ha sido aprobada",
        read: true,
      },
      {
        organizationId: org.id,
        userId: superUser.id,
        type: NotificationType.SUCCESS,
        title: "Backup completado",
        message: "Respaldo automático ejecutado correctamente",
        read: false,
      },
      {
        organizationId: org.id,
        userId: systemUser.id,
        type: NotificationType.ALERT,
        title: "Licencia por vencer",
        message: "La licencia SIGAF vence en 90 días",
        link: "/settings/licenses",
      },
      {
        organizationId: org.id,
        userId: consultUser.id,
        type: NotificationType.INFO,
        title: "Bienvenido a SIGAF",
        message: "Su cuenta de consulta ha sido activada",
        read: true,
      },
      {
        organizationId: org.id,
        userId: docAdmin.id,
        type: NotificationType.ERROR,
        title: "Transferencia retrasada",
        message: "La transferencia TRF-2025-002 requiere atención",
        link: "/transfers/TRF-2025-002",
      },
    ],
  });

  console.log("⚙️ Creando configuración del sistema...");
  await prisma.systemSetting.createMany({
    data: [
      {
        organizationId: org.id,
        key: "app.version",
        value: { version: "v2.5.1", build: "20260115", environment: "demo" },
      },
      {
        organizationId: org.id,
        key: "storage",
        value: {
          provider: "local",
          basePath: "/storage",
          maxFileSizeMb: 50,
          allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png", "application/msword"],
        },
      },
      {
        organizationId: org.id,
        key: "notifications",
        value: { emailEnabled: true, inAppEnabled: true, loanReminderDays: 3 },
      },
    ],
  });

  console.log("🔑 Creando licencia...");
  const licenseExpiry = new Date();
  licenseExpiry.setFullYear(licenseExpiry.getFullYear() + 1);

  await prisma.license.create({
    data: {
      organizationId: org.id,
      licenseKey: "SIGAF-DEMO-2026-XXXX-YYYY-ZZZZ",
      plan: "ENTERPRISE",
      seats: 50,
      expiresAt: licenseExpiry,
      active: true,
    },
  });

  console.log("💾 Creando registro de backup...");
  await prisma.backupRecord.create({
    data: {
      organizationId: org.id,
      filePath: `/backups/${org.id}/sigaf-backup-2026-01-15.sql.gz`,
      sizeBytes: 52428800,
      status: "COMPLETED",
    },
  });

  console.log("\n✅ Seed completado exitosamente");
  console.log(`   Organización: ${org.name}`);
  console.log(`   Roles: ${roles.length} | Permisos: ${permissions.length}`);
  console.log(`   Dependencias: ${dependencies.length} | Usuarios: ${users.length + 1}`);
  console.log(`   Series: ${seriesDefs.length} | Documentos: ${documents.length} | Expedientes: ${expedientes.length}`);
  console.log(`   Contraseña demo: ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
