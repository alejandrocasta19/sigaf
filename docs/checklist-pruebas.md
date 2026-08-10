# Checklist de pruebas SIGAF

Ejecutar con el servidor en `http://localhost:3000` y Postgres activo.

## Comandos automáticos

```bash
npm test
npx tsx scripts/smoke-production-sim.ts
npx tsx scripts/test-suite-full.ts
npx tsx scripts/stress-load.ts
npm run build
```

O todo junto:

```bash
npm run test:all
```

## Manual por rol (UI)

| Rol | Cuenta | Qué verificar |
|-----|--------|----------------|
| Super Admin | `super@sigaf.local` | Usuarios CRUD, settings, roles, jobs, backups |
| Doc Admin | `documental@sigaf.local` | Approvals archivo, TRD, lifecycle, disposals, FUID |
| Jefe | `jefe@sigaf.local` | `/approvals` aprobar/rechazar de su dependencia |
| Funcionario | `funcionario@sigaf.local` | `/documents/new` carga + archivo |
| Consulta | `consulta@sigaf.local` | Solo lectura; no crear usuarios/docs |

Password demo: `Sigaf2026!`

## Última corrida automática (referencia)

| Suite | Resultado |
|-------|-----------|
| Vitest (`npm test`) | 14/14 |
| Smoke (`test:smoke`) | 42/42 |
| Full (`test:full`) | 37/37 |
| Stress (`test:stress`) | 50 GET + 10 submit + 15 login OK |
| `npm run build` | Debe pasar tras lint limpio |

Notas: el rate-limit de login en desarrollo admite más intentos (`LOGIN_RATE_MAX`); las suites usan `x-forwarded-for` distinto por caso negativo. Un préstamo puede responder 404 si el documento no está prestable.

## Casos borde

- [ ] Login con password incorrecta
- [ ] Transferencia sin checklist (debe fallar)
- [ ] Usuario con correo duplicado
- [ ] No auto-eliminarse
- [ ] QR exacto desde `/qr`
- [ ] Export TRD / FUID abre en Excel
- [ ] Backup crea registro en `/backups`
