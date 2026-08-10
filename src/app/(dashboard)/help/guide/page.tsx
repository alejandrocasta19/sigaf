import { getSession } from "@/shared/kernel/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

const sections = [
  {
    title: "Primeros pasos",
    items: [
      "Inicie sesión con sus credenciales institucionales.",
      "Revise el panel principal según su rol asignado.",
      "Configure su perfil desde el menú de usuario.",
    ],
  },
  {
    title: "Gestión documental",
    items: [
      "Registre documentos desde Documentos → Nuevo.",
      "Agrupe documentos en expedientes por proceso o trámite.",
      "Use la búsqueda avanzada o el escáner QR para localizar registros.",
    ],
  },
  {
    title: "Archivo físico",
    items: [
      "Organice cajas y carpetas en Archivo Físico.",
      "Asigne ubicaciones según la estructura del archivo central.",
      "Realice inventarios periódicos desde el módulo de Inventarios.",
    ],
  },
  {
    title: "Préstamos y transferencias",
    items: [
      "Solicite préstamos desde el módulo Préstamos.",
      "Los jefes de dependencia aprueban solicitudes en Aprobaciones.",
      "Gestione transferencias entre dependencias en Transferencias.",
    ],
  },
];

export default async function HelpGuidePage() {
  const user = await getSession();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Guía de usuario</h1>
        <p className="text-sm text-slate-500">Manual de uso del sistema SIGAF</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {sections.map((s) => (
          <Card key={s.title}>
            <CardHeader>
              <CardTitle>{s.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-inside list-disc space-y-2 text-sm text-slate-600">
                {s.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
