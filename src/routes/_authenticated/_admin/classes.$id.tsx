import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar } from "./members";
import { Check, UserPlus, Clock } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/_admin/classes/$id")({
  head: () => ({
    meta: [
      { title: "Clase — Dlovebox" },
      { name: "description", content: "Detalle de clase, asistentes y lista de espera." },
      { property: "og:title", content: "Clase — Dlovebox" },
      { property: "og:description", content: "Detalle y asistentes de la clase." },
    ],
  }),
  component: ClassDetail,
});

function ClassDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const cls = useQuery({
    queryKey: ["class", id],
    queryFn: async () => (await supabase.from("classes").select("*, coach:coach_id(full_name)").eq("id", id).maybeSingle()).data,
  });

  const attendees = useQuery({
    queryKey: ["class-attendees", id],
    queryFn: async () => (await supabase
      .from("class_attendees")
      .select("id, status, member:member_id(id, full_name, photo_url)")
      .eq("class_id", id)).data ?? [],
  });

  const mark = useMutation({
    mutationFn: async ({ attId, status }: { attId: string; status: "asistio" | "inscrito" }) => {
      const { error } = await supabase.from("class_attendees").update({ status }).eq("id", attId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["class-attendees", id] }),
  });

  const c = cls.data;
  if (!c) return <AdminShell title="Clase" showBack><p className="p-6 text-center text-sm">Cargando...</p></AdminShell>;

  const inscritos = attendees.data?.filter((a) => a.status !== "lista_espera") ?? [];
  const espera = attendees.data?.filter((a) => a.status === "lista_espera") ?? [];
  const asistidos = inscritos.filter((a) => a.status === "asistio").length;
  const pct = c.capacity ? Math.min(100, (inscritos.length / c.capacity) * 100) : 0;

  return (
    <AdminShell title={c.name} showBack>
      <div className="rounded-3xl border bg-card p-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />{c.start_time?.slice(0, 5)} · {c.coach?.full_name || "Sin coach"}
        </div>
        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="text-4xl font-black">{inscritos.length}<span className="text-lg text-muted-foreground">/{c.capacity}</span></p>
            <p className="text-xs text-muted-foreground">Ocupación</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-primary">{asistidos}</p>
            <p className="text-xs text-muted-foreground">Asistieron</p>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Inscritos</h2>
        <AddParticipant classId={id} />
      </div>
      <div className="mt-2 space-y-2">
        {inscritos.length === 0 && <p className="rounded-2xl border border-dashed p-4 text-center text-xs text-muted-foreground">Sin inscritos</p>}
        {inscritos.map((a) => (
          <div key={a.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
            <Avatar name={a.member?.full_name ?? "?"} url={a.member?.photo_url} size={36} />
            <p className="min-w-0 flex-1 truncate text-sm font-medium">{a.member?.full_name}</p>
            <Button size="sm" variant={a.status === "asistio" ? "default" : "outline"}
              onClick={() => mark.mutate({ attId: a.id, status: a.status === "asistio" ? "inscrito" : "asistio" })}
              className="rounded-full h-8">
              <Check className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {espera.length > 0 && (
        <>
          <h2 className="mt-6 text-sm font-bold uppercase tracking-widest text-muted-foreground">Lista de espera</h2>
          <div className="mt-2 space-y-2">
            {espera.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
                <Avatar name={a.member?.full_name ?? "?"} url={a.member?.photo_url} size={36} />
                <p className="min-w-0 flex-1 truncate text-sm">{a.member?.full_name}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </AdminShell>
  );
}

function AddParticipant({ classId }: { classId: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const qc = useQueryClient();
  const search = useQuery({
    queryKey: ["members-search", q],
    queryFn: async () => (await supabase.from("members").select("id, full_name, photo_url").ilike("full_name", `%${q}%`).limit(10)).data ?? [],
    enabled: q.length > 0,
  });
  const add = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from("class_attendees").insert({ class_id: classId, member_id: memberId, status: "inscrito" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Agregado"); qc.invalidateQueries({ queryKey: ["class-attendees", classId] }); setOpen(false); setQ(""); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="rounded-full h-8 gap-1"><UserPlus className="h-3 w-3" />Agregar</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader><DialogTitle>Agregar participante</DialogTitle></DialogHeader>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar miembro..." />
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {(search.data ?? []).map((m) => (
            <button key={m.id} onClick={() => add.mutate(m.id)}
              className="flex w-full items-center gap-3 rounded-xl bg-secondary p-2 text-left">
              <Avatar name={m.full_name} url={m.photo_url} size={32} />
              <span className="text-sm">{m.full_name}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
