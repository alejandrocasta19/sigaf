# Capacidad SIGAF — 500+ usuarios

SIGAF queda **stateless**: Next.js no guarda archivos ni sesiones de cola. PostgreSQL guarda metadatos; MinIO/S3 el binario; Redis la cola y la caché del dashboard.

## Componentes

| Pieza | Rol |
|---|---|
| Next.js (1..N réplicas) | Auth, RBAC, metadatos, URLs firmadas |
| PostgreSQL | Expedientes, documentos, auditoría (`filePath` = storage key) |
| Redis | BullMQ, caché dashboard 45s, rate limit API/login |

| MinIO / S3 | PDF, imágenes, Office |
| Worker | Hash SHA-256, OCR/texto PDF, antivirus opcional, reportes, import |

## Subida (no pasa por Next.js)

1. `POST /api/v1/uploads/intent` — valida MIME/tamaño y firma PUT
2. Cliente `PUT` al storage (MinIO o `/api/v1/uploads/stream` en local)
3. `POST /api/v1/uploads/complete` — HEAD + encola `file.process`

Descarga: `GET /api/v1/files` redirige a URL firmada GET.

## Límites (env, no hardcoded de negocio)

- `UPLOAD_MAX_MB`
- `UPLOAD_MAX_PDF_MB`
- `UPLOAD_MAX_IMAGE_MB`
- `UPLOAD_MAX_OFFICE_MB`

## Pool Prisma

`DATABASE_URL=...&connection_limit=10&pool_timeout=20` por instancia.

Con 3+ réplicas: PgBouncer en modo transacción (`pgbouncer=true`).

## Entorno de pruebas

```bash
docker compose -f docker-compose.yml -f docker-compose.staging.yml up --build
k6 run -e BASE_URL=http://localhost:3000 -e EMAIL=... -e PASSWORD=... scripts/k6-capacity.js
```

Rampa: 10 → 50 → 100 → 250 → 500 VUs.

Criterios: login no cae, dashboard p95 acotado, conexiones Postgres estables, RAM de Next.js **no** escala con el tamaño de los PDF.

## Worker local (sin Docker)

```bash
# Redis en marcha
npm run worker
```

`STORAGE_DRIVER=local` usa disco `UPLOAD_DIR` con el mismo contrato de keys y PUT firmado HMAC.

## Rate limit

- Login: Redis (`login:{ip}`), con fallback en memoria si no hay `REDIS_URL`.
- API: el middleware Edge llama a `POST /api/internal/rate-limit`, que incrementa Redis. Sin Redis, el tope es por proceso (Map).
