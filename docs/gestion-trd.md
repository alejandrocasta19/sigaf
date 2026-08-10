# Gestión de las TRD — COOTRANSHUILA

Módulo prioritario de **Tablas de Retención Documental** en SIGAF.

## Alcance

1. **TRD**: series, subseries, tipologías, retención AG/AC, disposición final (Conservación / Selección / Eliminación).
2. **Estructura organizacional**: dependencias con códigos institucionales (Gerencia `20`, Jurídica `30`, Contable `40`, …).
3. **Ciclo vital**: Archivo de Gestión → Central → Histórico → disposición (`/lifecycle`).
4. **Codificación**: expedientes `{dep}-{serie}-{año}-{seq}` (ej. `20-02-2026-00001`).
5. **Valores documentales**: Administrativo, Jurídico, Legal, Fiscal, Contable, Histórico.
6. **Transferencias**: módulo existente `/transfers` + ciclo vital AGN.
7. **Archivo físico**: ubicaciones Edificio→…→Caja→Carpeta (`/physical-archive`).
8. **Auditoría**: `AuditLog` + historial de workflow.
9. **Eliminación**: flujo en `/trd/disposals` (inventario → observaciones → concepto → acta).
10. **Glosario**: `/help/glossary`.

## Rutas

| Ruta | Descripción |
|------|-------------|
| `/trd` | Tabla de retención completa |
| `/trd/series/[id]` | Detalle de serie / subseries |
| `/trd/disposals` | Eliminación documental |
| `/instruments` | TRD / TVD / CCD / PGD |
| `/series` | Vista rápida de series |
| `/help/glossary` | Glosario archivístico |
| `/api/v1/trd` | API stats / tabla / eliminación |

## Dependencias seed (códigos)

| Código | Dependencia |
|--------|-------------|
| 10 | Consejo de Administración |
| 20 | Gerencia |
| 30 | Coordinación Jurídica |
| 40 | Coordinación Contable |
| 50 | Tesorería |
| 55 | Contratación |
| 60 | Cartera |
| 70 | Sistemas y Marketing |
| 80 | Recursos Humanos |
| 90 | Control Interno |
| 100 | HSEQ |
| 110 | Operativa y Transporte |
| 120 | Administración EDS |
| 130 | Archivo Central |
