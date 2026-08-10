# Flujo de aprobación documental por dependencia

Subproceso que garantiza la revisión y validación antes de incorporar documentos al Sistema de Gestión Documental (SIGAF).

## Flujo

```text
Funcionario de la Dependencia
            │
            ▼
Carga el documento → Pendiente de Revisión
            │
            ▼
Jefe de Dependencia
     ┌──────┴────────┐
  Rechazar        Aprobar
     │               │
     ▼               ▼
Corrección    Aprobado por Dependencia
                     │
                     ▼
        Administrador de Gestión Documental
              ┌──────┴────────┐
           Rechazar        Validar
              │               │
              ▼               ▼
        Ajustes al Jefe   Archivado
                          (código, QR, auditoría)
```

## Estados

| Estado | Descripción |
|--------|-------------|
| `DRAFT` | Borrador |
| `PENDING_REVIEW` | Pendiente de revisión del Jefe |
| `IN_REVIEW_DEPT` | En revisión por el Jefe |
| `REJECTED_DEPT` | Rechazado por dependencia (vuelve al funcionario) |
| `APPROVED_DEPT` | Aprobado por dependencia |
| `IN_REVIEW_ARCHIVE` | En revisión archivística |
| `REJECTED_ARCHIVE` | Rechazado por Gestión Documental (vuelve al Jefe) |
| `ARCHIVED` | Incorporado al archivo institucional |
| `TRANSFERRED` / `HISTORICAL` / `DELETED` | Ciclo vital / disposición |

## Roles demo

| Rol | Email | Contraseña |
|-----|-------|------------|
| Funcionario | `funcionario@sigaf.local` | `Sigaf2026!` |
| Funcionario 2 | `funcionario2@sigaf.local` | `Sigaf2026!` |
| Jefe Jurídica | `jefe@sigaf.local` | `Sigaf2026!` |
| Gestión Documental | `documental@sigaf.local` | `Sigaf2026!` |

## Pantallas

- `/documents/new` — carga del funcionario
- `/approvals` — bandeja del Jefe / revisión archivística / seguimiento del funcionario
- `/team` — equipo del Jefe de Dependencia
- `/documents/[id]` — detalle + historial de workflow + acciones

## API

`POST /api/v1/documents/workflow`

Acciones: `submit`, `approve_dept`, `reject_dept`, `approve_archive`, `reject_archive`, `resubmit`, `start_dept_review`.

`GET /api/v1/documents/workflow` — bandeja según rol.
