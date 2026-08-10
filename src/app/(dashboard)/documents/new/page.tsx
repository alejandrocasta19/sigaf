import { getSession } from "@/shared/kernel/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/shared/kernel/prisma";
import { SubmitDocumentForm } from "@/modules/documents/ui/submit-document-form";

export default async function NewDocumentPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  if (
    !["DEPT_WORKER", "DEPT_HEAD", "DOC_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN"].includes(
      user.roleCode
    )
  ) {
    redirect("/documents");
  }

  if (!user.dependencyId && user.roleCode === "DEPT_WORKER") {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        Su usuario no tiene dependencia asignada. Contacte al administrador.
      </div>
    );
  }

  const dependencyId =
    user.dependencyId ??
    (
      await prisma.dependency.findFirst({
        where: { organizationId: user.organizationId, deletedAt: null },
      })
    )?.id;

  if (!dependencyId) redirect("/documents");

  const dependency = await prisma.dependency.findUniqueOrThrow({
    where: { id: dependencyId },
  });

  const [documentTypes, series, subseries] = await Promise.all([
    prisma.documentType.findMany({
      where: { organizationId: user.organizationId, active: true },
      orderBy: [{ category: "desc" }, { name: "asc" }],
    }),
    prisma.documentarySeries.findMany({
      where: { organizationId: user.organizationId, active: true },
      orderBy: { code: "asc" },
    }),
    prisma.documentarySubseries.findMany({
      where: { series: { organizationId: user.organizationId, active: true }, active: true },
      orderBy: { code: "asc" },
    }),
  ]);

  const typologies = documentTypes.filter((t) => t.category === "TYPOLOGY");
  const typesForForm = typologies.length > 0 ? typologies : documentTypes;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Cargar documento</h1>
        <p className="text-sm text-slate-500">
          Flujo de aprobación: Funcionario → Jefe de Dependencia → Gestión Documental
        </p>
      </div>
      <SubmitDocumentForm
        dependencyId={dependency.id}
        dependencyName={dependency.name}
        documentTypes={typesForForm.map((t) => ({
          id: t.id,
          name: t.category === "TYPOLOGY" ? `${t.name} (tipología)` : t.name,
          code: t.code,
        }))}
        series={series.map((s) => ({ id: s.id, name: s.name, code: s.code }))}
        subseries={subseries.map((s) => ({
          id: s.id,
          name: s.name,
          code: s.code,
          seriesId: s.seriesId,
        }))}
      />
    </div>
  );
}
