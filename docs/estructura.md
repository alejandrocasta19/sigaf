# Estructura del monolito modular SIGAF

```
sigaf/
├── prisma/                     # Schema, migraciones, seed
├── docs/                       # Documentación técnica
├── uploads/                    # Archivos subidos (fuera de git)
├── docker-compose.yml
└── src/
    ├── app/                    # Next.js App Router (capas delgadas)
    │   ├── (auth)/             # Login
    │   ├── (dashboard)/        # Páginas UI por ruta
    │   └── api/                # Controllers HTTP (auth + /api/v1)
    │
    ├── modules/                # Dominio — bounded contexts
    │   ├── identity/           # Usuarios, roles, permisos, sesiones
    │   ├── organizations/      # Organizaciones y dependencias
    │   ├── documents/          # Documentos, versiones, anexos
    │   ├── expedientes/
    │   ├── physical-archive/   # Ubicaciones, cajas, carpetas
    │   ├── loans-transfers/
    │   ├── archival-instruments/
    │   ├── search-reports/     # Búsqueda, import/export
    │   ├── notifications/
    │   └── system-admin/       # Dashboard KPIs, settings
    │
    ├── shared/                 # Transversal (sin lógica de negocio)
    │   ├── kernel/             # prisma, auth, http, storage, types
    │   ├── ui/                 # Design system (Button, Card, …)
    │   ├── layout/             # Sidebar, Header
    │   ├── charts/
    │   └── list/
    │
    ├── jobs/                   # Tareas asíncronas in-process
    ├── config/                 # Constantes / feature flags (opcional)
    └── middleware.ts           # Auth edge
```

## Regla de cada módulo

```
modules/<nombre>/
  application/     # Casos de uso / servicios
  ui/              # Componentes React del dominio (opcional)
  index.ts         # ÚNICA API pública del módulo (facade)
```

**Importar siempre desde el facade:**

```ts
// ✅
import { listDocuments } from "@/modules/documents";

// ❌ No importar application interno desde otro módulo
import { listDocuments } from "@/modules/documents/application/documents-service";
```

## Capas

| Capa | Ubicación | Responsabilidad |
|------|-----------|-----------------|
| Presentación | `app/(dashboard)`, `modules/*/ui` | UI y formularios |
| API | `app/api/**` | Validación Zod + orquestación |
| Aplicación | `modules/*/application` | Reglas de negocio |
| Kernel | `shared/kernel` | Infra compartida |
| UI kit | `shared/ui` | Componentes genéricos |

## Dependencias permitidas

```
app → modules (facade) → shared/kernel
app → shared/ui | shared/layout
modules/A → modules/B solo vía facade de B
modules ↛ app
```
