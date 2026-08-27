import { getSession } from "@/shared/kernel/auth";
import { redirect } from "next/navigation";
import { listTeamMembers } from "@/modules/documents";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";

export default async function TeamPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.roleCode !== "DEPT_HEAD") redirect("/dashboard");

  const team = await listTeamMembers(user);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title text-xl font-bold text-slate-900 sm:text-2xl">Mi equipo</h1>
        <p className="text-sm text-slate-500">
          Funcionarios de {user.dependencyName ?? "su dependencia"} que cargan documentos
          al flujo de aprobación
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Integrantes ({team.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-slate-500">
                <th className="pb-3 font-medium">Nombre</th>
                <th className="pb-3 font-medium">Correo</th>
                <th className="pb-3 font-medium">Rol</th>
                <th className="pb-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {team.map((m) => (
                <tr key={m.id} className="border-b border-slate-50">
                  <td className="py-3 font-medium">
                    {m.firstName} {m.lastName}
                  </td>
                  <td className="py-3 text-slate-600">{m.email}</td>
                  <td className="py-3">{m.role.name}</td>
                  <td className="py-3">
                    <Badge variant={m.status === "ACTIVE" ? "success" : "muted"}>
                      {m.status}
                    </Badge>
                  </td>
                </tr>
              ))}
              {team.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">
                    Aún no hay funcionarios asignados a esta dependencia.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
