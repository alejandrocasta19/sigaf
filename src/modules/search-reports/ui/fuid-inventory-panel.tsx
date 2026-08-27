"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Input, Label } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { StatusBadge } from "@/shared/list/status-labels";

type Inv = {
  id: string;
  code: string;
  title: string;
  transferCode: string | null;
  status: string;
  createdAt: string | Date;
  _count: { items: number };
};

type InvItem = {
  id: string;
  orderNumber: number | null;
  expedienteCode: string | null;
  seriesName: string | null;
  subseriesName: string | null;
  subject: string | null;
  unitName: string | null;
  dateStart: string | null;
  dateEnd: string | null;
  supportPhysical: boolean;
  supportElectronic: boolean;
  boxCode: string | null;
  folderNumber: string | null;
  folioCount: number | null;
  format: string | null;
  quantity: number | null;
  location: string | null;
  notes: string | null;
};

type InvDetail = {
  id: string;
  code: string;
  title: string;
  transferCode: string | null;
  status: string;
  entitySender: string | null;
  entityProducer: string | null;
  adminUnit: string | null;
  producerOffice: string | null;
  objectDescription: string | null;
  items: InvItem[];
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador",
  IN_PREPARATION: "En preparación",
  VALIDATED: "Validado",
  SENT: "Enviado a transferencia",
};

function fmtInputDate(d: string | null) {
  if (!d) return "";
  return d.slice(0, 10);
}

function FuidInventoryEditor({
  inventoryId,
  onClose,
}: {
  inventoryId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [detail, setDetail] = useState<InvDetail | null>(null);

  async function load() {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/inventories/${inventoryId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      const inv = json.data as InvDetail & {
        items: (InvItem & { dateStart?: string | Date | null; dateEnd?: string | Date | null })[];
      };
      setDetail({
        ...inv,
        items: inv.items.map((it) => ({
          ...it,
          dateStart: it.dateStart ? String(it.dateStart) : null,
          dateEnd: it.dateEnd ? String(it.dateEnd) : null,
        })),
      });
      setLoaded(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded && !detail) {
    return (
      <div className="mt-3 rounded-lg border border-slate-200 p-4">
        <Button size="sm" disabled={busy} onClick={() => void load()}>
          {busy ? "Cargando…" : "Cargar formulario FUID"}
        </Button>
      </div>
    );
  }

  if (!detail) return null;

  async function save() {
    if (!detail) return;
    setBusy(true);
    try {
      const payload = detail;
      const res = await fetch(`/api/v1/inventories/${inventoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: payload.title,
          transferCode: payload.transferCode,
          entitySender: payload.entitySender,
          entityProducer: payload.entityProducer,
          adminUnit: payload.adminUnit,
          producerOffice: payload.producerOffice,
          objectDescription: payload.objectDescription,
          items: payload.items.map((it) => ({
            id: it.id,
            orderNumber: it.orderNumber ?? undefined,
            seriesName: it.seriesName ?? undefined,
            subseriesName: it.subseriesName ?? undefined,
            subject: it.subject ?? undefined,
            expedienteCode: it.expedienteCode ?? undefined,
            unitName: it.unitName ?? undefined,
            dateStart: it.dateStart,
            dateEnd: it.dateEnd,
            supportPhysical: it.supportPhysical,
            supportElectronic: it.supportElectronic,
            boxCode: it.boxCode ?? undefined,
            folderNumber: it.folderNumber ?? undefined,
            folioCount: it.folioCount,
            format: it.format ?? undefined,
            quantity: it.quantity,
            location: it.location ?? undefined,
            notes: it.notes ?? undefined,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      toast.success("FUID actualizado");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-4 rounded-lg border border-emerald-200 bg-emerald-50/20 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-emerald-900">Formulario FUID — {detail.code}</p>
        <Button size="sm" variant="outline" onClick={onClose}>
          Cerrar
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Entidad remitente</Label>
          <Input
            value={detail.entitySender ?? ""}
            onChange={(e) => setDetail({ ...detail, entitySender: e.target.value })}
          />
        </div>
        <div>
          <Label>Entidad productora</Label>
          <Input
            value={detail.entityProducer ?? ""}
            onChange={(e) => setDetail({ ...detail, entityProducer: e.target.value })}
          />
        </div>
        <div>
          <Label>Unidad administrativa</Label>
          <Input
            value={detail.adminUnit ?? ""}
            onChange={(e) => setDetail({ ...detail, adminUnit: e.target.value })}
          />
        </div>
        <div>
          <Label>Oficina productora</Label>
          <Input
            value={detail.producerOffice ?? ""}
            onChange={(e) => setDetail({ ...detail, producerOffice: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <Label>Objeto</Label>
          <Input
            value={detail.objectDescription ?? ""}
            onChange={(e) => setDetail({ ...detail, objectDescription: e.target.value })}
          />
        </div>
        <div>
          <Label>Número de transferencia (NT)</Label>
          <Input
            value={detail.transferCode ?? ""}
            onChange={(e) => setDetail({ ...detail, transferCode: e.target.value })}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <p className="mb-2 text-sm font-medium text-slate-700">Unidades documentales</p>
        <table className="w-full min-w-[960px] text-left text-xs">
          <thead>
            <tr className="border-b text-slate-500">
              <th className="pb-1 pr-1">#</th>
              <th className="pb-1 pr-1">Código</th>
              <th className="pb-1 pr-1">Serie</th>
              <th className="pb-1 pr-1">Unidad</th>
              <th className="pb-1 pr-1">F. ini</th>
              <th className="pb-1 pr-1">F. fin</th>
              <th className="pb-1 pr-1">Fís</th>
              <th className="pb-1 pr-1">Elec</th>
              <th className="pb-1 pr-1">Caja</th>
              <th className="pb-1 pr-1">Carp</th>
              <th className="pb-1 pr-1">Folios</th>
              <th className="pb-1 pr-1">Notas</th>
            </tr>
          </thead>
          <tbody>
            {detail.items.map((it, idx) => (
              <tr key={it.id} className="border-b border-slate-50">
                <td className="py-1 pr-1">{it.orderNumber ?? idx + 1}</td>
                <td className="py-1 pr-1 font-mono">{it.expedienteCode}</td>
                <td className="py-1 pr-1">
                  <Input
                    className="h-7 text-xs"
                    value={it.seriesName ?? ""}
                    onChange={(e) => {
                      const items = [...detail.items];
                      items[idx] = { ...it, seriesName: e.target.value };
                      setDetail({ ...detail, items });
                    }}
                  />
                </td>
                <td className="py-1 pr-1">
                  <Input
                    className="h-7 text-xs"
                    value={it.unitName ?? ""}
                    onChange={(e) => {
                      const items = [...detail.items];
                      items[idx] = { ...it, unitName: e.target.value };
                      setDetail({ ...detail, items });
                    }}
                  />
                </td>
                <td className="py-1 pr-1">
                  <Input
                    type="date"
                    className="h-7 text-xs"
                    value={fmtInputDate(it.dateStart)}
                    onChange={(e) => {
                      const items = [...detail.items];
                      items[idx] = { ...it, dateStart: e.target.value || null };
                      setDetail({ ...detail, items });
                    }}
                  />
                </td>
                <td className="py-1 pr-1">
                  <Input
                    type="date"
                    className="h-7 text-xs"
                    value={fmtInputDate(it.dateEnd)}
                    onChange={(e) => {
                      const items = [...detail.items];
                      items[idx] = { ...it, dateEnd: e.target.value || null };
                      setDetail({ ...detail, items });
                    }}
                  />
                </td>
                <td className="py-1 pr-1 text-center">
                  <input
                    type="checkbox"
                    checked={it.supportPhysical}
                    onChange={(e) => {
                      const items = [...detail.items];
                      items[idx] = { ...it, supportPhysical: e.target.checked };
                      setDetail({ ...detail, items });
                    }}
                  />
                </td>
                <td className="py-1 pr-1 text-center">
                  <input
                    type="checkbox"
                    checked={it.supportElectronic}
                    onChange={(e) => {
                      const items = [...detail.items];
                      items[idx] = { ...it, supportElectronic: e.target.checked };
                      setDetail({ ...detail, items });
                    }}
                  />
                </td>
                <td className="py-1 pr-1">
                  <Input
                    className="h-7 w-16 text-xs"
                    value={it.boxCode ?? ""}
                    onChange={(e) => {
                      const items = [...detail.items];
                      items[idx] = { ...it, boxCode: e.target.value };
                      setDetail({ ...detail, items });
                    }}
                  />
                </td>
                <td className="py-1 pr-1">
                  <Input
                    className="h-7 w-16 text-xs"
                    value={it.folderNumber ?? ""}
                    onChange={(e) => {
                      const items = [...detail.items];
                      items[idx] = { ...it, folderNumber: e.target.value };
                      setDetail({ ...detail, items });
                    }}
                  />
                </td>
                <td className="py-1 pr-1">
                  <Input
                    type="number"
                    className="h-7 w-14 text-xs"
                    value={it.folioCount ?? ""}
                    onChange={(e) => {
                      const items = [...detail.items];
                      items[idx] = {
                        ...it,
                        folioCount: e.target.value ? Number(e.target.value) : null,
                      };
                      setDetail({ ...detail, items });
                    }}
                  />
                </td>
                <td className="py-1 pr-1">
                  <Input
                    className="h-7 text-xs"
                    value={it.notes ?? ""}
                    onChange={(e) => {
                      const items = [...detail.items];
                      items[idx] = { ...it, notes: e.target.value };
                      setDetail({ ...detail, items });
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={() => void save()}>
          Guardar FUID
        </Button>
        <a
          href={`/api/v1/inventories/fuid?inventoryId=${detail.id}&objeto=${encodeURIComponent(detail.objectDescription ?? detail.title)}`}
          className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
        >
          Exportar Excel AGN
        </a>
        <a
          href={`/api/v1/inventories/fuid?format=pdf&inventoryId=${detail.id}&objeto=${encodeURIComponent(detail.objectDescription ?? detail.title)}`}
          className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
        >
          Exportar PDF AGN
        </a>
      </div>
    </div>
  );
}

export function FuidInventoryPanel({ initialInventories }: { initialInventories: Inv[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialInventories);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [transferCode, setTransferCode] = useState("");
  const [objeto, setObjeto] = useState("Transferencias primarias");
  const [entitySender, setEntitySender] = useState("");
  const [entityProducer, setEntityProducer] = useState("");
  const [adminUnit, setAdminUnit] = useState("");
  const [producerOffice, setProducerOffice] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function createInventory() {
    if (!title.trim()) {
      toast.error("Título requerido");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/v1/inventories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${objeto} — ${title.trim()}`,
          transferCode: transferCode.trim() || undefined,
          objectDescription: objeto,
          entitySender: entitySender.trim() || undefined,
          entityProducer: entityProducer.trim() || undefined,
          adminUnit: adminUnit.trim() || undefined,
          producerOffice: producerOffice.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      toast.success(`Inventario ${json.data.code} creado`);
      setTitle("");
      setTransferCode("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function validate(id: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/v1/inventories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "validate" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      toast.success("Inventario validado");
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: "VALIDATED" } : i))
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Inventario documental (FUID)</CardTitle>
          <p className="text-sm text-slate-500">
            Formato Único de Inventario Documental — Acuerdo AGN 001 de 2024, Anexo 3
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Entidad remitente</Label>
              <Input value={entitySender} onChange={(e) => setEntitySender(e.target.value)} placeholder="COOTRANSHUILA" />
            </div>
            <div>
              <Label>Entidad productora</Label>
              <Input value={entityProducer} onChange={(e) => setEntityProducer(e.target.value)} placeholder="COOTRANSHUILA" />
            </div>
            <div>
              <Label>Unidad administrativa</Label>
              <Input value={adminUnit} onChange={(e) => setAdminUnit(e.target.value)} placeholder="Dirección administrativa" />
            </div>
            <div>
              <Label>Oficina productora</Label>
              <Input value={producerOffice} onChange={(e) => setProducerOffice(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Objeto (FUID)</Label>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={objeto}
                onChange={(e) => setObjeto(e.target.value)}
              >
                <option>Transferencias primarias</option>
                <option>Transferencias secundarias</option>
                <option>Valoración de fondos acumulados</option>
                <option>Inventarios individuales</option>
                <option>Fusión o supresión de dependencias</option>
              </select>
            </div>
            <div>
              <Label>Título del inventario</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Inventario gestión 2026" />
            </div>
            <div>
              <Label>NT (número de transferencia)</Label>
              <Input value={transferCode} onChange={(e) => setTransferCode(e.target.value)} placeholder="TR-2026-001" />
            </div>
          </div>
          <Button disabled={busy} onClick={createInventory}>
            Nuevo inventario
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inventarios ({items.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-slate-500">
                <th className="pb-2">Código</th>
                <th className="pb-2">Título</th>
                <th className="pb-2">Transferencia</th>
                <th className="pb-2">Ítems</th>
                <th className="pb-2">Estado</th>
                <th className="pb-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((inv) => (
                <Fragment key={inv.id}>
                  <tr className="border-b border-slate-50">
                    <td className="py-2 font-mono">{inv.code}</td>
                    <td className="py-2">{inv.title}</td>
                    <td className="py-2">{inv.transferCode ?? "—"}</td>
                    <td className="py-2">{inv._count.items}</td>
                    <td className="py-2">
                      <StatusBadge
                        label={STATUS_LABEL[inv.status] ?? inv.status}
                        variant={inv.status === "VALIDATED" ? "success" : "warning"}
                      />
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setExpandedId(expandedId === inv.id ? null : inv.id)}
                        >
                          {expandedId === inv.id ? "Ocultar" : "Editar FUID"}
                        </Button>
                        {inv.status !== "VALIDATED" && (
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => validate(inv.id)}>
                            Validar
                          </Button>
                        )}
                        <a
                          href={`/api/v1/inventories/fuid?inventoryId=${inv.id}&objeto=${encodeURIComponent(inv.title)}`}
                          className="inline-flex items-center rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
                        >
                          Excel
                        </a>
                        <a
                          href={`/api/v1/inventories/fuid?format=pdf&inventoryId=${inv.id}&objeto=${encodeURIComponent(inv.title)}`}
                          className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-800 hover:bg-emerald-100"
                        >
                          PDF
                        </a>
                      </div>
                    </td>
                  </tr>
                  {expandedId === inv.id && (
                    <tr>
                      <td colSpan={6}>
                        <FuidInventoryEditor
                          inventoryId={inv.id}
                          onClose={() => setExpandedId(null)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    Sin inventarios. Cree uno para diligenciar el FUID.
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
