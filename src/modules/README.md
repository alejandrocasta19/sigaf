# Módulos SIGAF

Cada carpeta es un **bounded context**. Consume solo su `index.ts`.

| Módulo | Dominio |
|--------|---------|
| `identity` | Auth, usuarios, roles, permisos |
| `organizations` | Multi-empresa y dependencias |
| `documents` | Documentos, versiones, anexos |
| `expedientes` | Expedientes documentales |
| `physical-archive` | Archivo físico (ubicaciones/cajas/carpetas) |
| `loans-transfers` | Préstamos y transferencias |
| `archival-instruments` | TRD, TVD, CCD, PGD, series |
| `search-reports` | Búsqueda e import/export |
| `notifications` | Alertas in-app |
| `system-admin` | Dashboard, KPIs, admin global |

Ver [docs/estructura.md](../../docs/estructura.md).
