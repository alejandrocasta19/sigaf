import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const role = await prisma.role.findFirst({ where: { code: "DEPT_WORKER" } });
  if (!role) {
    console.log("no DEPT_WORKER role");
    return;
  }
  const perms = await prisma.permission.findMany({
    where: { code: { in: ["loans.read", "loans.create", "loans.update"] } },
  });
  console.log(
    "perms",
    perms.map((p) => p.code)
  );
  for (const p of perms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: p.id } },
      create: { roleId: role.id, permissionId: p.id },
      update: {},
    });
  }
  console.log("DEPT_WORKER loans permissions OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
