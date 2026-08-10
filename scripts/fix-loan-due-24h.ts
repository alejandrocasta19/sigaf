/**
 * Normaliza préstamos ACTIVE: vencimiento = approvedAt + 24h (regla de negocio).
 * Uso: npx tsx scripts/fix-loan-due-24h.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const HOURS_24 = 24 * 60 * 60 * 1000;

async function main() {
  const active = await prisma.loan.findMany({
    where: { status: { in: ["ACTIVE", "APPROVED"] } },
    select: { id: true, code: true, approvedAt: true, dueDate: true, status: true },
  });

  let fixed = 0;
  let overdue = 0;
  const now = Date.now();

  for (const loan of active) {
    const base = loan.approvedAt ?? new Date();
    const due = new Date(base.getTime() + HOURS_24);
    const nextStatus = due.getTime() < now ? "OVERDUE" : "ACTIVE";

    await prisma.loan.update({
      where: { id: loan.id },
      data: {
        dueDate: due,
        status: nextStatus,
        ...(loan.status === "APPROVED" && nextStatus === "ACTIVE"
          ? { status: "ACTIVE" }
          : {}),
      },
    });

    if (nextStatus === "OVERDUE") overdue += 1;
    else fixed += 1;
    console.log(`${loan.code}: due=${due.toISOString()} → ${nextStatus}`);
  }

  console.log(`OK: ${fixed} activos a 24h, ${overdue} marcados vencidos`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
