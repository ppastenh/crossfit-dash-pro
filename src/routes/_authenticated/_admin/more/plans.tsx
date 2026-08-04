import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

type Plan = {
  id: string;
  name: string;
  price: number;
  duration_days: number;
  benefits: string[] | null;
};

const empty = { name: "", price: "", duration_days: "30", benefits: [] as string[] };

function PlansPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Plan | null>(null);
  const [creating, setCreating] = useState(false);

  const plans = useQuery({
    queryKey: ["plans"],
    queryFn: async () =>
      ((await supabase.from("plans").select("*").order("price")).data ?? []) as unknown as Plan[],
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plan eliminado");
      qc.invalidateQueries({ queryKey: ["plans"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  return (
    <AdminShell
      title="Planes"
      showBack
      right={
        <button
          onClick={() => setCreating(true)}
          className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
        </button>
      }
    >
      <div className="space-y-3">
        {plans.data?.length === 0 && (
          <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Sin planes creados
          </p>
        )}
        {plans.data?.map((p) => (
          <div key={p.id} className="rounded-2xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold">{p.name}</p>
                <p className="text-[11px] text-muted-foreground">{p.duration_days} días</p>
              </div>
              <p className="shrink-0 text-lg font-black text-primary">
                ${Number(p.price).toLocaleString()}
              </p>
            </div>

            {(p.benefits?.length ?? 0) > 0 && (
              <div className="mt-3 rounded-xl bg-secondary/60 p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Beneficios incluidos
                </p>
                <ul className="mt-2 space-y-1.5">
                  {p.benefits!.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-10 rounded-full" onClick={() => setEditing(p)}>
                <Pencil className="mr-2 h-4 w-4" /> Editar
              </Button>
              <Button
                variant="outline"
                disabled={del.isPending}
                onClick={() => {
                  if (confirm(`¿Eliminar el plan "${p.name}"?`)) del.mutate(p.id);
                }}
                className="h-10 rounded-full border-destructive/40 text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" /> Eliminar
              </Button>
            </div>
          </div>
        ))}
      </div>

      <PlanDialog
        open={creating || !!editing}
        plan={editing}
        onOpenChange={(v) => {
          if (!v) {
            setCreating(false);
            setEditing(null);
          }
        }}
      />
    </AdminShell>
  );
}

function PlanDialog({
  open,
  plan,
  onOpenChange,
}: {
  open: boolean;
  plan: Plan | null;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState(empty);
  const [benefit, setBenefit] = useState("");
  const [key, setKey] = useState<string | null>(null);

  // sync form when the target plan changes
  const currentKey = plan?.id ?? "new";
  if (open && key !== currentKey) {
    setKey(currentKey);
    setF(
      plan
        ? {
            name: plan.name,
            price: String(plan.price),
            duration_days: String(plan.duration_days),
            benefits: plan.benefits ?? [],
          }
        : empty,
    );
    setBenefit("");
  }

  const mut = useMutation({
    mutationFn: async () => {
      const payload = {
        name: f.name,
        price: Number(f.price),
        duration_days: Number(f.duration_days),
        benefits: f.benefits,
      };
      const { error } = plan
        ? await supabase.from("plans").update(payload).eq("id", plan.id)
        : await supabase.from("plans").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(plan ? "Plan actualizado" : "Plan creado");
      qc.invalidateQueries({ queryKey: ["plans"] });
      setKey(null);
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const addBenefit = () => {
    const v = benefit.trim();
    if (!v) return;
    setF((s) => ({ ...s, benefits: [...s.benefits, v] }));
    setBenefit("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setKey(null);
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-sm overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle>{plan ? "Editar plan" : "Nuevo plan"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mut.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <Label>Nombre</Label>
            <Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Precio</Label>
              <Input
                required
                type="number"
                step="0.01"
                value={f.price}
                onChange={(e) => setF({ ...f, price: e.target.value })}
              />
            </div>
            <div>
              <Label>Duración (días)</Label>
              <Input
                required
                type="number"
                value={f.duration_days}
                onChange={(e) => setF({ ...f, duration_days: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label>Beneficios incluidos (opcional)</Label>
            <div className="mt-1 flex gap-2">
              <Input
                value={benefit}
                placeholder="Ej: Acceso a todas las clases del box"
                onChange={(e) => setBenefit(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addBenefit();
                  }
                }}
              />
              <Button type="button" variant="outline" className="shrink-0 rounded-full" onClick={addBenefit}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <ul className="mt-2 space-y-1.5">
              {f.benefits.map((b, i) => (
                <li key={i} className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-xs">
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">{b}</span>
                  <button
                    type="button"
                    onClick={() => setF((s) => ({ ...s, benefits: s.benefits.filter((_, j) => j !== i) }))}
                    className="text-muted-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <Button type="submit" disabled={mut.isPending} className="h-11 w-full rounded-full font-semibold">
            Guardar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
