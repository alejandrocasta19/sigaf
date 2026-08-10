# Checklist de seguridad / go-live SIGAF

Este documento cubre lo **automatizable en el repo** y lo que **debe hacerse en infraestructura**.
Un pentest externo real lo realiza una firma especializada; aquí hay una auditoría interna (`npm run test:security`).

## Qué ya está en el código

| Control | Estado |
|---------|--------|
| Sesiones revocables + `sessionId` en JWT | Sí |
| HTTPS forzado en producción (`FORCE_HTTPS`, vía `x-forwarded-proto`) | Sí |
| Rate limit login + rate limit API global | Sí |
| CSRF Origin/Referer en mutaciones API | Sí |
| Headers (XFO, nosniff, Referrer-Policy, CSP básica) | Sí |
| Política de contraseñas (≥10, mayúscula, minúscula, número, especial) | Sí |
| MFA TOTP opcional por usuario (`/settings/security`) | Sí |
| Alertas in-app tras ≥5 logins fallidos / 15 min | Sí |
| Gates de página (users, roles, backups, audit, settings, orgs, licenses, deps) | Sí |
| Uploads: tamaño + allowlist | Sí |
| Generador de secretos | `npm run secrets:generate` |
| Auditoría interna automatizada | `npm run test:security` |

## Obligatorio antes de internet público

1. **Generar secretos** y no usar demos:
   ```bash
   npm run secrets:generate
   ```
   Pegue `JWT_SECRET`, `CSRF_SECRET` y password de Postgres en `.env` / secrets del orquestador.

2. **HTTPS** delante de Node (Caddy / Nginx / ALB) con certificado válido.
   - `APP_URL=https://...`
   - Proxy debe enviar `X-Forwarded-Proto: https`
   - En LAN sin TLS: `ALLOW_HTTP=true` (no usar en internet)

3. **Postgres**
   - No exponer el puerto 5432 a Internet (solo red interna Docker/VPC)
   - Password fuerte distinta a `sigaf_secret`
   - Backups automáticos (`pg_dump` / snapshots) + prueba de restore
   - Updates de imagen `postgres:16-alpine`

4. **WAF / perímetro**
   - Preferible Cloudflare / AWS WAF / Nginx limit_req delante de la app
   - El rate limit in-process de Next **no** sustituye WAF multi-nodo

5. **Sistema operativo**
   - Usuario no-root para la app
   - Firewall (solo 80/443 públicos)
   - Parches OS periódicos

6. **Pentest externo** *(no automatizable en este repo)*
   - Contratar revisión OWASP ASVS / prueba de penetración con firma externa
   - Ejecutar también: `npm run test:security` en staging tras cada release
   - El script interno **no** sustituye un pentest real

7. **Operación**
   - Revisar `/audit` y notificaciones de accesos fallidos (≥5 / 15 min)
   - Job `system.backup` programado (cron / tasks); el dashboard avisa si >36 h
   - Activar MFA en cuentas admin (`/settings/security`) — obligatorio si hay datos de archivo institucional sensibles
   - Tras rotar `JWT_SECRET`, forzar re-login de todos los usuarios

## Perfiles de exposición

| Escenario | Requisito mínimo |
|-----------|------------------|
| Demo / LAN | Secretos no-demo + HTTPS opcional |
| Intranet VPN | Todo el checklist excepto WAF cloud |
| Internet | Checklist completo + pentest externo |

## Comandos útiles

```bash
npm run secrets:generate
npm run test:security
npm run test:all
npm run build && npm start
```
