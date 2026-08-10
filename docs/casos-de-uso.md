# Casos de uso por rol

## Super Administrador

- Autenticarse y ver panel global
- Administrar organizaciones, usuarios, roles y permisos
- Configurar parámetros, seguridad, backups y licencias
- Auditar toda la actividad del sistema
- Acceder a cualquier documento/expediente/dependencia

## Administrador de Gestión Documental

- Administrar TRD/TVD/CCD/PGD
- Crear y clasificar documentos y expedientes
- Gestionar archivo físico, cajas y carpetas
- Aprobar préstamos y transferencias
- Generar reportes e inventarios

## Jefe de Dependencia

- Supervisar solo su dependencia
- Crear documentos/expedientes del área
- Aprobar procesos internos y préstamos
- Consultar indicadores de su dependencia

## Usuario de Consulta

- Buscar y consultar documentos autorizados
- Escanear QR / código de barras
- Descargar documentos permitidos
- Ver historial y reportes de solo lectura

## Diagrama de secuencia — Login

```mermaid
sequenceDiagram
  participant U as Usuario
  participant UI as LoginPage
  participant API as api/auth/login
  participant DB as PostgreSQL
  U->>UI: email + password
  UI->>API: POST /api/auth/login
  API->>DB: buscar usuario + bcrypt
  API->>DB: crear Session + AccessLog
  API-->>UI: cookie HttpOnly JWT
  UI->>U: redirect /dashboard
```

## Diagrama de clases (simplificado)

```mermaid
classDiagram
  Organization "1" --> "*" User
  Organization "1" --> "*" Document
  Role "1" --> "*" User
  Role "*" --> "*" Permission
  User --> Dependency
  Document --> Dependency
  Document --> Expediente
  Document --> Folder
  Folder --> Box
  Box --> Location
  Document --> Loan
  User --> AuditLog
```
