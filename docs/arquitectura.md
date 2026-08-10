# Arquitectura SIGAF — Monolito Modular

## Visión

SIGAF se despliega como **un solo proceso Next.js** con fronteras de módulo claras (bounded contexts). Una base PostgreSQL multi-tenant por `organizationId`. Escala por índices, paginación cursor, jobs y storage de archivos fuera de BD.

## Capas

1. **Presentación:** `src/app` (páginas + API thin controllers)
2. **Módulos de dominio:** `src/modules/<contexto>`
3. **Kernel:** `src/shared/kernel` (prisma, auth JWT, RBAC, audit, http)
4. **UI compartida:** `src/shared/ui`

## Módulos

| Módulo | Responsabilidad |
|--------|-----------------|
| identity | Usuarios, roles, permisos, sesiones, login |
| organizations | Organizaciones y dependencias |
| documents | Documentos, versiones, anexos, firmas |
| expedientes | Expedientes documentales |
| physical-archive | Ubicaciones, cajas, carpetas |
| loans-transfers | Préstamos y transferencias |
| archival-instruments | TRD, TVD, CCD, PGD, políticas |
| search-reports | Búsqueda full-text y reportes |
| notifications | Alertas in-app |
| system-admin | Settings, backups, licencias, dashboard KPIs |

## Seguridad

- JWT en cookie HttpOnly (`sigaf_token`)
- bcrypt para contraseñas
- Middleware de autenticación
- RBAC por rol + códigos de permiso
- Rate limit en login
- Auditoría append-only
- Soft-delete + papelera

## Roles

Super Admin (100%) → System Admin (90%) → Doc Admin (80%) → Jefe Dependencia (60%) → Consulta (20%)
