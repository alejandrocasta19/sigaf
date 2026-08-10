# Ciclo vital documental — Ley 594 de 2000 y AGN

SIGAF implementa las **tres fases del archivo** definidas en el artículo 23 de la [Ley 594 de 2000](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=4275) (Ley General de Archivos) y alineadas con los lineamientos técnicos del **Archivo General de la Nación (AGN)**.

## Fases

| Fase | Archivo | En SIGAF (`ArchivalPhase`) | Consulta | Responsabilidad |
|------|---------|----------------------------|----------|-----------------|
| **Activa** | Archivo de Gestión | `MANAGEMENT` | Frecuente / trámite diario | Oficinas productoras (dependencias) |
| **Semiactiva** | Archivo Central | `CENTRAL` | Esporádica | Archivo Central de la entidad |
| **Inactiva** | Archivo Histórico | `HISTORICAL` | Patrimonio / investigación | Archivo Histórico |

### Transferencias (AGN / TRD)

- **Primaria** (`TransferKind.PRIMARY`): Gestión → Central  
- **Secundaria** (`TransferKind.SECONDARY`): Central → Histórico  
- **Disposición** (`DISPOSAL`): eliminación u otra disposición final según TRD  
- **Interna** (`INTERNAL`): entre dependencias sin cambio de fase  

## Rutas en la aplicación

- `/lifecycle` — panel del ciclo vital y transferencias de fase  
- `/lifecycle/management` — inventario Archivo de Gestión  
- `/lifecycle/central` — inventario Archivo Central  
- `/lifecycle/historical` — inventario Archivo Histórico  
- API: `GET/POST /api/v1/lifecycle`, `POST /api/v1/lifecycle/:id/complete`

## Referencias

- Ley 594 de 2000, arts. 21–24 (PGD, procesos archivísticos, formación de archivos, TRD)  
- Acuerdo AGN sobre transferencias documentales y tablas de retención  
- Concepto de **archivo total** y ciclo vital del documento  

Documentos y expedientes nacen en `MANAGEMENT`. Al completar una transferencia primaria/secundaria, SIGAF actualiza `archivalPhase` y registra auditoría.
