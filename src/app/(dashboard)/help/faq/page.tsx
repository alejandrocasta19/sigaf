import { getSession } from "@/shared/kernel/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

const faqs = [
  {
    q: "¿Cómo recupero mi contraseña?",
    a: "Contacte al administrador del sistema para restablecer sus credenciales de acceso.",
  },
  {
    q: "¿Puedo ver documentos de otras dependencias?",
    a: "Depende de su rol. Los usuarios de consulta y jefes de dependencia solo acceden a documentos autorizados para su área.",
  },
  {
    q: "¿Cómo solicito un préstamo documental?",
    a: "Busque el documento, verifique su disponibilidad y registre la solicitud desde el módulo Préstamos.",
  },
  {
    q: "¿Qué es un instrumento archivístico?",
    a: "Son documentos normativos como la TRD (Tabla de Retención Documental) que definen series, tiempos de conservación y disposición final.",
  },
  {
    q: "¿Cómo funciona el escáner QR?",
    a: "Ingrese o escanee el código QR del documento en el módulo QR para consultar su ficha archivística.",
  },
  {
    q: "¿Dónde veo la auditoría del sistema?",
    a: "Los administradores pueden consultar el registro de actividades en el módulo Auditoría.",
  },
];

export default async function HelpFaqPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title text-xl font-bold text-slate-900 sm:text-2xl">Preguntas frecuentes</h1>
        <p className="text-sm text-slate-500">Respuestas a consultas comunes sobre SIGAF</p>
      </div>

      <div className="space-y-3">
        {faqs.map((f) => (
          <Card key={f.q}>
            <CardHeader>
              <CardTitle className="text-base">{f.q}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">{f.a}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
