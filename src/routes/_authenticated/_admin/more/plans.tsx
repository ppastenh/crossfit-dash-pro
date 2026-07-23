import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_admin/more/plans")({
  head: () => ({
    meta: [
      { title: "Planes — Dlovebox" },
      { name: "description", content: "Planes de membresía." },
      { property: "og:title", content: "Planes — Dlovebox" },
      { property: "og:description", content: "Planes de membresía." },
    ],
  }),
  component: PlansPage,
});

function PlansPage() {
  const plans = useQuery({
    queryKey: ["plans"],
    queryFn: async () => (await supabase.from("plans").select("*").order("price")).data ?? [],
  });
  return (
    <AdminShell title="Planes" showBack right={<AddPlan />}>
      <div className="space-y-2">
        {plans.data?.length === 0 && <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">Sin planes creados</p>}
        {plans.data?.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-2xl border bg-card p-4">
            <div>
              <p className="text-sm font-bold">{p.name}</p>
              <p className="text-[11px] text-muted-foreground">{p.duration_days} días</p>
            </div>
            <p className="text-lg font-black text-primary">${Number(p.price).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}

function AddPlan() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const [f, setF] = useState({ name: "", price: "", duration_days: "30" });
  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("plans").insert({ name: f.name, price: Number(f.price), duration_days: Number(f.duration_days) });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Plan creado"); qc.invalidateQueries({ queryKey: ["plans"] }); setOpen(false); setF({ name: "", price: "", duration_days: "30" }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground"><Plus className="h-4 w-4" /></button>
      </DialogTrigger>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader><DialogTitle>Nuevo plan</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
          <div><Label>Nombre</Label><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div><Label>Precio</Label><Input required type="number" step="0.01" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></div>
          <div><Label>Duración (días)</Label><Input required type="number" value={f.duration_days} onChange={(e) => setF({ ...f, duration_days: e.target.value })} /></div>
          <Button type="submit" disabled={mut.isPending} className="w-full rounded-full h-11 font-semibold">Guardar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
