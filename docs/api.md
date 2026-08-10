# API REST SIGAF

Base: `/api/v1` (excepto auth en `/api/auth`)

Respuestas: `{ success: true, data }` o `{ success: false, error }`.
Permisos: códigos `module.action` (p. ej. `documents.read`). `SUPER_ADMIN` bypasea.

## Auth

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Login email/password → cookie JWT |
| POST | `/api/auth/logout` | Cierra sesión |
| GET | `/api/auth/me` | Usuario actual |
| GET | `/api/health` | Healthcheck |

## Documentos y workflow

| Método | Ruta | Notas |
|--------|------|-------|
| GET/POST | `/api/v1/documents` | `documents.read` / `documents.create` |
| GET/PATCH/DELETE | `/api/v1/documents/:id` | Soft delete |
| POST | `/api/v1/documents/workflow` | submit / approve_* / reject_* / resubmit |
| POST | `/api/v1/documents/:id/versions` | Multipart archivo |
| POST | `/api/v1/documents/:id/attachments` | Anexos |
| POST | `/api/v1/documents/:id/digitize` | Multipart → filePath + texto PDF en searchText |
| GET/POST | `/api/v1/documents/:id/signatures` | Firma hash SHA-256 (MVP) |
| POST | `/api/v1/documents/import` | Importación |

## TRD / instrumentos / eliminación

| Método | Ruta | Notas |
|--------|------|-------|
| GET/POST | `/api/v1/trd` | Stats / disposals |
| GET/POST | `/api/v1/trd/manage` | CRUD series, import/export Excel, snapshot |
| GET/POST | `/api/v1/trd/disposal-candidates` | Candidatos TRD + PDF inventario |
| GET/POST | `/api/v1/instruments` | TVD/CCD/PGD create + upload PDF |

## Ciclo vital / físico

| Método | Ruta | Notas |
|--------|------|-------|
| GET/POST | `/api/v1/lifecycle` | Transferencias de fase (checklist obligatorio) |
| POST | `/api/v1/lifecycle/:id/complete` | Completar transferencia |
| GET | `/api/v1/lifecycle/:id/inventory` | Inventario Excel |
| GET/POST | `/api/v1/physical-inventories` | Inventario físico + validaciones |
| GET/POST | `/api/v1/boxes` | Cajas |
| GET/POST | `/api/v1/folders` | Carpetas |

## Expedientes / usuarios / reportes

| Método | Ruta | Notas |
|--------|------|-------|
| GET/POST | `/api/v1/expedientes` | Scope por dependencia |
| GET/PATCH/DELETE | `/api/v1/expedientes/:id` | |
| GET/POST | `/api/v1/users` | Admin + `users.*` |
| GET | `/api/v1/roles` | |
| GET | `/api/v1/reports?type=&format=` | xlsx/pdf/csv |
| GET | `/api/v1/inventories/fuid` | Export FUID Excel (AGN) |
| GET | `/api/v1/search?q=` | Búsqueda; `exactQr=1` para QR exacto |
| GET | `/api/v1/audit` | Auditoría |
| GET | `/api/v1/notifications` | |
| GET/PUT | `/api/v1/settings` | SystemSetting JSON |
| GET/POST | `/api/v1/jobs` | `system.backup`, `retention.scan`, `disposal.candidates.notify` |
| GET | `/api/v1/files` | Descarga/preview |

## Jobs

Payload POST: `{ "type": "system.backup" | "retention.scan" | "disposal.candidates.notify" }`.
Ejecución in-process; resultado en tabla `jobs`.
