import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth } from "date-fns";
import { Plus, TrendingUp, Clock, AlertTriangle } from "lucide-react";
import { StatusChip } from "./members";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_admin/finances")({
  head: () => ({
    meta: [
      { title: "Finanzas — Dlovebox" },
      { name: "description", content: "Ingresos, pagos pendientes y renovaciones próximas del box." },
      { property: "og:title", content: "Finanzas — Dlovebox" },
      { property: "og:description", content: "Ingresos y pagos." },
    ],
  }),
  component: FinancesPage,
});

function FinancesPage() {
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");

  const stats = useQuery({
    queryKey: ["fin-stats", monthStart],
    queryFn: async () => {
      const [income, pending, upcoming] = await Promise.all([
        supabase.from("payments").select("amount").eq("status", "pagado").gte("paid_at", monthStart),
        supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "pendiente"),
        supabase.from("members").select("id", { count: "exact", head: true }).gte("next_payment", today).lte("next_payment", format(new Date(Date.now() + 7 * 864e5), "yyyy-MM-dd")),
      ]);
      const total = (income.data ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);
      return { total, pending: pending.count ?? 0, upcoming: upcoming.count ?? 0 };
    },
  });

  const recent = useQuery({
    queryKey: ["recent-payments"],
    queryFn: async () => (await supabase
      .from("payments")
      .select("*, member:member_id(full_name)")
      .order("created_at", { ascending: false })
      .limit(20)).data ?? [],
  });

  return (
    <AdminShell title="Finanzas">
      <div className="rounded-3xl border border-primary/40 bg-primary/10 p-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
          <TrendingUp className="h-4 w-4" /> Ingresos del mes
        </div>
        <p className="mt-2 text-4xl font-black">${(stats.data?.total ?? 0).toLocaleString()}</p>
        <p className="text-xs text-muted-foreground">{format(new Date(), "MMMM yyyy")}</p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border bg-card p-4">
          <Clock className="h-4 w-4 text-warning" />
          <p className="mt-2 text-2xl font-black">{stats.data?.pending ?? 0}</p>
          <p className="text-xs text-muted-foreground">Pagos pendientes</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <p className="mt-2 text-2xl font-black">{stats.data?.upcoming ?? 0}</p>
          <p className="text-xs text-muted-foreground">Renovaciones 7d</p>
        </div>
      </div>

      <div className="mt-6 mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Últimos pagos</h2>
        <AddPaymentDialog />
      </div>
      <div className="space-y-2">
        {recent.data?.length === 0 && <p className="rounded-2xl border border-dashed p-4 text-center text-xs text-muted-foreground">Sin pagos aún</p>}
        {recent.data?.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-2xl border bg-card p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{p.member?.full_name}</p>
              <p className="text-[11px] text-muted-foreground">{p.paid_at ? format(new Date(p.paid_at), "dd MMM yyyy") : "—"} · {p.method || "—"}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <p className="text-sm font-black">${Number(p.amount).toLocaleString()}</p>
              <StatusChip status={p.status} />
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}

function AddPaymentDialog() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const qc = useQueryClient();
  const [form, setForm] = useState({ member_id: "", plan_id: "", amount: "", method: "efectivo", status: "pagado" });

  const plans = useQuery({
    queryKey: ["plans"],
    queryFn: async () => (await supabase.from("plans").select("id, name, price").order("name")).data ?? [],
  });

  const members = useQuery({
    queryKey: ["pay-members", q],
    queryFn: async () => (await supabase.from("members").select("id, full_name, plan_id").ilike("full_name", `%${q}%`).limit(10)).data ?? [],
  });

  function pickPlan(planId: string) {
    const p = (plans.data ?? []).find((x) => x.id === planId);
    setForm((f) => ({ ...f, plan_id: planId, amount: p ? String(p.price) : f.amount }));
  }


  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("payments").insert({
        member_id: form.member_id,
        amount: Number(form.amount),
        method: form.method,
        status: form.status as "pagado",
        paid_at: form.status === "pagado" ? new Date().toISOString() : null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Pago registrado"); qc.invalidateQueries(); setOpen(false); setQ(""); setForm({ member_id: "", plan_id: "", amount: "", method: "efectivo", status: "pagado" }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="rounded-full gap-1"><Plus className="h-3 w-3" />Pago</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader><DialogTitle>Registrar pago</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
          <div>
            <Label>Miembro</Label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar..." />
            <div className="mt-1 max-h-32 space-y-1 overflow-y-auto">
              {(members.data ?? []).map((m) => (
                <button key={m.id} type="button" onClick={() => {
                  const p = (plans.data ?? []).find((x) => x.id === m.plan_id);
                  setForm({ ...form, member_id: m.id, plan_id: m.plan_id ?? "", amount: p ? String(p.price) : form.amount });
                  setQ(m.full_name);
                }}
                  className={`block w-full rounded-lg p-2 text-left text-sm ${form.member_id === m.id ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                  {m.full_name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Plan</Label>
            <Select value={form.plan_id} onValueChange={pickPlan}>
              <SelectTrigger><SelectValue placeholder="Selecciona un plan" /></SelectTrigger>
              <SelectContent>
                {(plans.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} — ${Number(p.price).toLocaleString()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Monto</Label><Input type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Método</Label>
              <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="tarjeta">Tarjeta</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pagado">Pagado</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" disabled={mut.isPending || !form.member_id} className="w-full rounded-full h-11 font-semibold">
            {mut.isPending ? "Guardando..." : "Registrar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
