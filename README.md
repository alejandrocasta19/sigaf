# SIGAF — Sistema Integral de Gestión de Archivos Físicos y Documentales

Monolito modular empresarial (Next.js 15 + Prisma + PostgreSQL) con RBAC, dashboards por rol y gestión documental física/electrónica.

## Requisitos

- Node.js 20+
- Docker Desktop (PostgreSQL 16)

## Arranque rápido

```bash
docker compose up -d
cp .env.example .env   # si aún no tienes .env
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

## Usuarios demo

| Rol | Email | Contraseña |
|-----|-------|------------|
| Super Administrador | `super@sigaf.local` | `Sigaf2026!` |
| Admin Sistema | `sistema@sigaf.local` | `Sigaf2026!` |
| Gestión Documental | `documental@sigaf.local` | `Sigaf2026!` |
| Jefe de Dependencia | `jefe@sigaf.local` | `Sigaf2026!` |
| Funcionario de Dependencia | `funcionario@sigaf.local` | `Sigaf2026!` |
| Usuario Consulta | `consulta@sigaf.local` | `Sigaf2026!` |

Flujo de aprobación documental: [`docs/flujo-aprobacion-documental.md`](./docs/flujo-aprobacion-documental.md).

## Arquitectura

Monolito modular. Detalle en [`docs/estructura.md`](./docs/estructura.md).

```
src/
  app/           → rutas Next.js (UI + API delgadas)
  modules/       → dominio (identity, documents, expedientes, …)
  shared/        → kernel, UI kit, layout, charts
  jobs/          → tareas asíncronas
```

Cada módulo expone solo su `index.ts` (facade). La UI de dominio vive en `modules/*/ui`.

Documentación: [`docs/`](./docs/) · Ciclo vital: [`docs/ciclo-vital-ley-594.md`](./docs/ciclo-vital-ley-594.md) · **TRD (prioridad):** [`docs/gestion-trd.md`](./docs/gestion-trd.md) · Aprobación: [`docs/flujo-aprobacion-documental.md`](./docs/flujo-aprobacion-documental.md).

Organización demo: **COOTRANSHUILA**.

## Scripts

- `npm run dev` — desarrollo
- `npm run build` / `npm start` — producción
- `npm run db:migrate` — migraciones
- `npm run db:seed` — datos demo
- `npm run db:reset` — reset completo BD
