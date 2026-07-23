import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, UserCog } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_admin/more/coaches")({
  head: () => ({
    meta: [
      { title: "Coaches — Dlovebox" },
      { name: "description", content: "Gestión de coaches del box." },
      { property: "og:title", content: "Coaches — Dlovebox" },
      { property: "og:description", content: "Coaches del box." },
    ],
  }),
  component: CoachesPage,
});

function CoachesPage() {
  const coaches = useQuery({
    queryKey: ["coaches"],
    queryFn: async () => (await supabase.from("coaches").select("*").order("full_name")).data ?? [],
  });
  return (
    <AdminShell title="Coaches" showBack right={<AddCoach />}>
      <div className="space-y-2">
        {coaches.data?.length === 0 && <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">Sin coaches</p>}
        {coaches.data?.map((c) => (
          <div key={c.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-secondary"><UserCog className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{c.full_name}</p>
              <p className="truncate text-[11px] text-muted-foreground">{c.specialty || c.email || "—"}</p>
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}

function AddCoach() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const [f, setF] = useState({ full_name: "", email: "", phone: "", specialty: "" });
  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("coaches").insert(f);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Coach agregado"); qc.invalidateQueries({ queryKey: ["coaches"] }); setOpen(false); setF({ full_name: "", email: "", phone: "", specialty: "" }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground"><Plus className="h-4 w-4" /></button>
      </DialogTrigger>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader><DialogTitle>Nuevo coach</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
          <div><Label>Nombre</Label><Input required value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
          <div><Label>Especialidad</Label><Input value={f.specialty} onChange={(e) => setF({ ...f, specialty: e.target.value })} /></div>
          <div><Label>Email</Label><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div><Label>Teléfono</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <Button type="submit" disabled={mut.isPending} className="w-full rounded-full h-11 font-semibold">Guardar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
