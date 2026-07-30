import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, UserCog, ShieldCheck, Link2, Pause, Play, Trash2, Mail } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_admin/more/coaches")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Coaches — Dlovebox" },
      { name: "description", content: "Gestión de coaches y permisos del box." },
      { property: "og:title", content: "Coaches — Dlovebox" },
      { property: "og:description", content: "Coaches y permisos del box." },
    ],
  }),
  component: CoachesPage,
});

type Permissions = Record<string, boolean>;

type Coach = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  specialty: string | null;
  status: string;
  user_id: string | null;
  permissions: Permissions;
};

const PERMISSIONS: Array<{ key: string; label: string; hint: string }> = [
  { key: "classes_create", label: "Crear clases", hint: "Puede programar nuevas clases y WODs" },
  { key: "classes_edit", label: "Editar clases", hint: "Modificar o cancelar clases existentes" },
  { key: "attendance_mark", label: "Marcar asistencia", hint: "Check-in de atletas en sus clases" },
  { key: "bookings_manage", label: "Gestionar reservas", hint: "Agregar o quitar inscritos y lista de espera" },
  { key: "members_view", label: "Ver miembros", hint: "Acceso al listado y fichas de atletas" },
  { key: "members_edit", label: "Editar miembros", hint: "Modificar datos y estado de los atletas" },
  { key: "prs_manage", label: "Gestionar PRs", hint: "Registrar récords personales" },
  { key: "finances_view", label: "Ver finanzas", hint: "Acceso a ingresos y pagos" },
  { key: "payments_register", label: "Registrar pagos", hint: "Puede cobrar y registrar pagos" },
  { key: "files_manage", label: "Gestionar archivos", hint: "Subir o reemplazar contratos y documentos" },
];

function genCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function CoachesPage() {
  const coaches = useQuery({
    queryKey: ["coaches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("coaches").select("*").order("full_name");
      if (error) throw error;
      return (data ?? []) as unknown as Coach[];
    },
  });

  return (
    <AdminShell title="Coaches" showBack right={<AddCoach />}>
      <p className="mb-3 px-1 text-[11px] text-muted-foreground">
        Agrega coaches, invítalos a la app y define exactamente qué puede hacer cada uno.
      </p>
      <div className="space-y-2">
        {coaches.data?.length === 0 && (
          <div className="rounded-3xl border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">Aún no hay coaches</p>
            <div className="mt-4 flex justify-center"><AddCoach variant="cta" /></div>
          </div>
        )}
        {coaches.data?.map((c) => <CoachCard key={c.id} coach={c} />)}
      </div>
    </AdminShell>
  );
}

function CoachCard({ coach }: { coach: Coach }) {
  const qc = useQueryClient();
  const perms = coach.permissions ?? {};
  const granted = PERMISSIONS.filter((p) => perms[p.key]).length;
  const paused = coach.status === "pausado";

  const update = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { error } = await supabase.from("coaches").update(patch).eq("id", coach.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coaches"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("coaches").delete().eq("id", coach.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Coach eliminado"); qc.invalidateQueries({ queryKey: ["coaches"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  return (
    <div className="rounded-3xl border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-secondary"><UserCog className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">{coach.full_name}</p>
            {paused && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Pausado</span>}
            {coach.user_id && <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">Vinculado</span>}
          </div>
          <p className="truncate text-[11px] text-muted-foreground">{coach.specialty || coach.email || "—"}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <PermissionsDialog coach={coach} granted={granted} />
        <InviteCoach coach={coach} />
        <button
          onClick={() => update.mutate({ status: paused ? "activo" : "pausado" })}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary active:bg-secondary/70"
          aria-label={paused ? "Reanudar" : "Pausar"}
        >
          {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </button>
        <button
          onClick={() => remove.mutate()}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-destructive/15 text-destructive active:bg-destructive/25"
          aria-label="Eliminar"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function PermissionsDialog({ coach, granted }: { coach: Coach; granted: number }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [perms, setPerms] = useState<Permissions>(coach.permissions ?? {});

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("coaches").update({ permissions: perms }).eq("id", coach.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Permisos actualizados"); qc.invalidateQueries({ queryKey: ["coaches"] }); setOpen(false); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setPerms(coach.permissions ?? {}); }}>
      <DialogTrigger asChild>
        <button className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-secondary px-3 text-xs font-semibold active:bg-secondary/70">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Permisos · {granted}/{PERMISSIONS.length}
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] max-w-sm overflow-y-auto rounded-3xl">
        <DialogHeader><DialogTitle>Permisos de {coach.full_name}</DialogTitle></DialogHeader>
        <div className="divide-y divide-border/60">
          {PERMISSIONS.map((p) => (
            <div key={p.key} className="flex items-start gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{p.label}</p>
                <p className="text-[11px] text-muted-foreground">{p.hint}</p>
              </div>
              <Switch
                checked={!!perms[p.key]}
                onCheckedChange={(v) => setPerms((s) => ({ ...s, [p.key]: v }))}
              />
            </div>
          ))}
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="h-11 w-full rounded-full font-semibold">
          Guardar permisos
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function InviteCoach({ coach }: { coach: Coach }) {
  const invite = useMutation({
    mutationFn: async () => {
      const code = genCode();
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from("admin_invites").insert({
        code,
        role: "coach",
        email: coach.email || null,
        expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        created_by: userRes.user?.id ?? null,
      });
      if (error) throw error;
      return code;
    },
    onSuccess: async (code) => {
      await navigator.clipboard.writeText(`${window.location.origin}/auth?invite=${code}`);
      toast.success("Enlace de coach copiado", { description: code });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  return (
    <button
      onClick={() => invite.mutate()}
      disabled={invite.isPending || !!coach.user_id}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary active:bg-primary/25 disabled:opacity-40"
      aria-label="Invitar coach"
    >
      <Link2 className="h-4 w-4" />
    </button>
  );
}

function AddCoach({ variant }: { variant?: "cta" }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const [f, setF] = useState({ full_name: "", email: "", phone: "", specialty: "" });
  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("coaches").insert(f);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Coach agregado");
      qc.invalidateQueries({ queryKey: ["coaches"] });
      setOpen(false);
      setF({ full_name: "", email: "", phone: "", specialty: "" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "cta" ? (
          <Button className="h-11 rounded-full px-5 font-semibold"><Plus className="mr-2 h-4 w-4" /> Agregar coach</Button>
        ) : (
          <button className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground"><Plus className="h-4 w-4" /></button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader><DialogTitle>Nuevo coach</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
          <div><Label>Nombre</Label><Input required value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
          <div><Label>Especialidad</Label><Input value={f.specialty} onChange={(e) => setF({ ...f, specialty: e.target.value })} /></div>
          <div><Label>Email</Label><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div><Label>Teléfono</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <Mail className="mt-0.5 h-3 w-3 shrink-0" />
            Con el email podrás enviarle una invitación para que acceda a la app con rol de coach.
          </p>
          <Button type="submit" disabled={mut.isPending} className="h-11 w-full rounded-full font-semibold">Guardar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
