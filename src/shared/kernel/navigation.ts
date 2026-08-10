import { RoleCode } from "@prisma/client";
import {
  LayoutDashboard,
  Building2,
  Users,
  Shield,
  Boxes,
  Settings,
  FileText,
  FolderOpen,
  Archive,
  Package,
  Handshake,
  ArrowLeftRight,
  Search,
  BarChart3,
  Bell,
  History,
  Database,
  KeyRound,
  Plug,
  ScrollText,
  Layers,
  ClipboardList,
  QrCode,
  HelpCircle,
  UserCircle,
  BookOpen,
  Inbox,
  CheckSquare,
  ScanLine,
  Table2,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  roles?: RoleCode[];
};

export type NavGroup = {
  title?: string;
  items: NavItem[];
  roles?: RoleCode[];
};

const all: RoleCode[] = [
  "SUPER_ADMIN",
  "SYSTEM_ADMIN",
  "DOC_ADMIN",
  "DEPT_HEAD",
  "DEPT_WORKER",
  "CONSULT_USER",
];

export const NAV_BY_ROLE: Record<RoleCode, NavGroup[]> = {
  SUPER_ADMIN: [
    {
      items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
    },
    {
      title: "ADMINISTRACIÓN GLOBAL",
      items: [
        { label: "Organizaciones", href: "/organizations", icon: Building2 },
        { label: "Usuarios", href: "/users", icon: Users },
        { label: "Roles y Permisos", href: "/roles", icon: Shield },
        { label: "Módulos del Sistema", href: "/settings/modules", icon: Boxes },
        { label: "Parámetros Globales", href: "/settings", icon: Settings },
        { label: "Seguridad", href: "/settings/security", icon: KeyRound },
        { label: "Auditoría del Sistema", href: "/audit", icon: History },
        { label: "Copias de Seguridad", href: "/backups", icon: Database },
        { label: "Integraciones", href: "/settings/integrations", icon: Plug },
        { label: "Licencias", href: "/licenses", icon: ScrollText },
      ],
    },
    {
      title: "GESTIÓN DOCUMENTAL",
      items: [
        { label: "Gestión de TRD", href: "/trd", icon: Table2 },
        { label: "Instrumentos Archivísticos", href: "/instruments", icon: Layers },
        { label: "Series Documentales", href: "/series", icon: ClipboardList },
        { label: "Expedientes", href: "/expedientes", icon: FolderOpen },
        { label: "Documentos", href: "/documents", icon: FileText },
        { label: "Aprobación documental", href: "/approvals", icon: CheckSquare },
        { label: "Transferencias", href: "/transfers", icon: ArrowLeftRight },
        { label: "Ciclo vital (AGN)", href: "/lifecycle", icon: Layers },
        { label: "Archivo Físico", href: "/physical-archive", icon: Archive },
        { label: "Préstamos", href: "/loans", icon: Handshake },
        { label: "Reportes", href: "/reports", icon: BarChart3 },
      ],
    },
    {
      title: "CONFIGURACIÓN",
      items: [
        { label: "Notificaciones", href: "/notifications", icon: Bell },
        { label: "Glosario", href: "/help/glossary", icon: BookOpen },
        { label: "Workflows", href: "/settings/workflows", icon: Layers },
        { label: "Configuración General", href: "/settings", icon: Settings },
      ],
    },
  ],
  SYSTEM_ADMIN: [
    {
      items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
    },
    {
      title: "ADMINISTRACIÓN",
      items: [
        { label: "Usuarios", href: "/users", icon: Users },
        { label: "Roles y Permisos", href: "/roles", icon: Shield },
        { label: "Dependencias", href: "/dependencies", icon: Building2 },
        { label: "Auditoría", href: "/audit", icon: History },
        { label: "Backups", href: "/backups", icon: Database },
        { label: "Configuración", href: "/settings", icon: Settings },
      ],
    },
    {
      title: "GESTIÓN DOCUMENTAL",
      items: [
        { label: "Documentos", href: "/documents", icon: FileText },
        { label: "Expedientes", href: "/expedientes", icon: FolderOpen },
        { label: "Archivo Físico", href: "/physical-archive", icon: Archive },
        { label: "Préstamos", href: "/loans", icon: Handshake },
        { label: "Reportes", href: "/reports", icon: BarChart3 },
      ],
    },
  ],
  DOC_ADMIN: [
    {
      items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
    },
    {
      title: "Navegación",
      items: [
        { label: "Gestión de TRD", href: "/trd", icon: Table2 },
        { label: "Documentos", href: "/documents", icon: FileText },
        { label: "Revisión archivística", href: "/approvals", icon: CheckSquare },
        { label: "Expedientes", href: "/expedientes", icon: FolderOpen },
        { label: "Instrumentos Archivísticos", href: "/instruments", icon: Layers },
        { label: "Ciclo vital (AGN)", href: "/lifecycle", icon: Archive },
        { label: "Archivo Físico", href: "/physical-archive", icon: Archive },
        { label: "Transferencias", href: "/transfers", icon: ArrowLeftRight },
        { label: "Préstamos", href: "/loans", icon: Handshake },
        { label: "Inventarios", href: "/inventories", icon: Package },
        { label: "Digitalización", href: "/documents/digitize", icon: ScanLine },
        { label: "Reportes", href: "/reports", icon: BarChart3 },
        { label: "Consultas", href: "/search", icon: Search },
        { label: "Bandeja de Tareas", href: "/tasks", icon: Inbox },
      ],
    },
    {
      title: "Configuración",
      items: [
        { label: "Tipos Documentales", href: "/document-types", icon: FileText },
        { label: "Series Documentales", href: "/series", icon: ClipboardList },
        { label: "Dependencias", href: "/dependencies", icon: Building2 },
        { label: "Glosario", href: "/help/glossary", icon: BookOpen },
        { label: "Parámetros", href: "/settings", icon: Settings },
      ],
    },
  ],
  DEPT_HEAD: [
    {
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Documentos", href: "/documents", icon: FileText },
        { label: "Aprobaciones", href: "/approvals", icon: CheckSquare },
        { label: "Mi equipo", href: "/team", icon: Users },
        { label: "Expedientes", href: "/expedientes", icon: FolderOpen },
        { label: "Mis Tareas", href: "/tasks", icon: Inbox },
        { label: "Préstamos", href: "/loans", icon: Handshake },
        { label: "Transferencias", href: "/transfers", icon: ArrowLeftRight },
        { label: "Ciclo vital (AGN)", href: "/lifecycle", icon: Layers },
        { label: "Consulta TRD", href: "/trd", icon: Table2 },
        { label: "Archivo Físico", href: "/physical-archive", icon: Archive },
        { label: "Consultas", href: "/search", icon: Search },
        { label: "Reportes", href: "/reports", icon: BarChart3 },
      ],
    },
    {
      title: "Configuración",
      items: [
        { label: "Perfil", href: "/profile", icon: UserCircle },
        { label: "Glosario", href: "/help/glossary", icon: BookOpen },
        { label: "Configuración", href: "/settings", icon: Settings },
      ],
    },
  ],
  DEPT_WORKER: [
    {
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Cargar documento", href: "/documents/new", icon: FileText },
        { label: "Mis documentos", href: "/documents", icon: FolderOpen },
        { label: "Bandeja de flujo", href: "/approvals", icon: Inbox },
        { label: "Préstamos", href: "/loans", icon: Handshake },
        { label: "Expedientes", href: "/expedientes", icon: FolderOpen },
        { label: "Consultas", href: "/search", icon: Search },
        { label: "Notificaciones", href: "/notifications", icon: Bell },
      ],
    },
    {
      title: "Ayuda",
      items: [
        { label: "Perfil", href: "/profile", icon: UserCircle },
        { label: "Glosario", href: "/help/glossary", icon: BookOpen },
        { label: "Guía de Usuario", href: "/help/guide", icon: BookOpen },
      ],
    },
  ],
  CONSULT_USER: [
    {
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Consultar Documentos", href: "/documents", icon: FileText },
        { label: "Consultar Expedientes", href: "/expedientes", icon: FolderOpen },
        { label: "Búsqueda Avanzada", href: "/search", icon: Search },
        { label: "Archivo Físico", href: "/physical-archive", icon: Archive },
        { label: "Escanear QR / Código", href: "/qr", icon: QrCode },
        { label: "Reportes Disponibles", href: "/reports", icon: BarChart3 },
      ],
    },
    {
      title: "Ayuda",
      items: [
        { label: "Glosario", href: "/help/glossary", icon: BookOpen },
        { label: "Guía de Usuario", href: "/help/guide", icon: BookOpen },
        { label: "Preguntas Frecuentes", href: "/help/faq", icon: HelpCircle },
      ],
    },
  ],
};

export function getNavForRole(role: RoleCode): NavGroup[] {
  return NAV_BY_ROLE[role] ?? NAV_BY_ROLE.CONSULT_USER;
}

export { all as ALL_ROLES };
