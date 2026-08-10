/**
 * Ajusta permisos de CONSULT_USER al modelo restringido del seed
 * (documents/expedientes/search/reports/loans/transfers × read/export).
 *
 * Uso: npx tsx scripts/fix-consult-perms.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ALLOWED_MODULES = new Set([
  "documents",
  "expedientes",
  "search",
  "reports",
  "loans",
  "transfers",
]);
const ALLOWED_ACTIONS = new Set(["read", "export"]);

async function main() {
  const role = await prisma.role.findUnique({ where: { code: "CONSULT_USER" } });
  if (!role) throw new Error("Rol CONSULT_USER no encontrado");

  const perms = await prisma.permission.findMany();
  const keep = perms.filter(
    (p) => ALLOWED_MODULES.has(p.module) && ALLOWED_ACTIONS.has(p.action)
  );

  await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
  await prisma.rolePermission.createMany({
    data: keep.map((p) => ({ roleId: role.id, permissionId: p.id })),
  });

  console.log(`CONSULT_USER actualizado: ${keep.length} permisos`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
