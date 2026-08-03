import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import {
  Search, Plus, User, Copy, RefreshCw, MessageCircle, Check, X,
  ChevronDown, UserRound, CalendarDays, MoreVertical, Pencil, CircleCheck,
  PlayCircle, PauseCircle, AlertCircle, Lock, Clock, KeyRound, Receipt, Trash2,
} from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/_admin/members")({
  head: () => ({
    meta: [
      { title: "Miembros — Dlovebox" },
      { name: "description", content: "Gestión de miembros del box: buscar, filtrar y administrar." },
      { property: "og:title", content: "Miembros — Dlovebox" },
      { property: "og:description", content: "Lista y gestión de miembros." },
    ],
  }),
  component: MembersPage,
});

type Status = "todos" | "activo" | "pausado" | "suspendido" | "vencido" | "bloqueado";
type MemberStatus = "activo" | "pausado" | "suspendido" | "vencido" | "bloqueado";

export type MemberListItem = {
  id: string;
  full_name: string;
  status: string;
  next_payment: string | null;
  photo_url: string | null;
  phone: string | null;
  email: string | null;
  plan?: { name: string } | null;
};

function MembersPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status>("todos");

  const { data: plans } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => (await supabase.from("plans").select("id, name, price, duration_days").order("name")).data ?? [],
  });

  const members = useQuery({
    queryKey: ["members", q, status],
    queryFn: async () => {
      let query = supabase.from("members").select("id, full_name, status, next_payment, photo_url, phone, email, plan:plan_id(name)").order("full_name");
      if (status !== "todos") query = query.eq("status", status);
      if (q) query = query.ilike("full_name", `%${q}%`);
      return (await query).data ?? [];
    },
  });

  return (
    <AdminShell title="Miembros">
      <BoxInviteCard />
      <PendingRequests />
      <div className="sticky top-[calc(env(safe-area-inset-top)+56px)] z-20 -mx-4 mb-4 space-y-3 bg-background/95 px-4 pb-3 pt-1 backdrop-blur">

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar miembro..." className="pl-9 rounded-full h-11 bg-card" />
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {(["todos", "activo", "pausado", "suspendido", "vencido", "bloqueado"] as Status[]).map((s) => (
            <button key={s} onClick={() => setStatus(s)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold capitalize ${status === s ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground border"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {members.isLoading && <SkeletonList />}
        {members.data?.length === 0 && (
          <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No hay miembros. Agrega el primero con el botón +
          </div>
        )}
        {members.data?.map((m) => (
          <MemberRow key={m.id} m={m as MemberListItem} />
        ))}
      </div>


      <AddMemberFab plans={plans ?? []} />
    </AdminShell>
  );
}

export function Avatar({ name, url, size = 44 }: { name: string; url?: string | null; size?: number }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return url ? (
    <img src={url} alt={name} style={{ width: size, height: size }} className="rounded-full object-cover" />
  ) : (
    <div style={{ width: size, height: size }} className="grid shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold text-foreground">
      {initials || <User className="h-4 w-4" />}
    </div>
  );
}

export function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    activo: "bg-primary/20 text-primary",
    pausado: "bg-sky-500/20 text-sky-400",
    suspendido: "bg-warning/20 text-warning",
    vencido: "bg-destructive/20 text-destructive",
    bloqueado: "bg-destructive/25 text-destructive",
  };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${map[status] ?? "bg-secondary"}`}>{status}</span>;
}

function MemberRow({ m }: { m: MemberListItem }) {
  const [expanded, setExpanded] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [book, setBook] = useState(false);


  const waHref = m.phone
    ? `https://wa.me/${m.phone.replace(/\D/g, "")}`
    : `https://wa.me/`;

  return (
    <div className="rounded-2xl border bg-card">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 p-3 text-left active:scale-[0.99] transition-transform"
      >
        <Avatar name={m.full_name} url={m.photo_url} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{m.full_name}</p>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            <StatusChip status={m.status} />
            {m.plan?.name && <span className="truncate">· {m.plan.name}</span>}
          </div>
        </div>
        {!expanded && m.next_payment && (
          <div className="text-right text-[10px] text-muted-foreground">
            <p className="font-semibold text-foreground">{format(new Date(m.next_payment), "dd MMM")}</p>
            <p>próximo pago</p>
          </div>
        )}
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="grid grid-cols-4 gap-1 border-t p-2">
          <Link
            to="/members/$id"
            params={{ id: m.id }}
            className="flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] text-muted-foreground active:bg-secondary"
          >
            <UserRound className="h-5 w-5" />
            Perfil
          </Link>
          <Link
            to="/classes"
            className="flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] text-primary active:bg-secondary"
          >
            <CalendarDays className="h-5 w-5" />
            Reservar
          </Link>
          <a
            href={waHref}
            target="_blank"
            rel="noreferrer"
            className="flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] text-primary active:bg-secondary"
          >
            <MessageCircle className="h-5 w-5" />
            Chat
          </a>
          <button
            onClick={() => setSheet(true)}
            className="flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] text-muted-foreground active:bg-secondary"
          >
            <MoreVertical className="h-5 w-5" />
            Más
          </button>
        </div>
      )}

      <MemberActionsSheet m={m} open={sheet} onOpenChange={setSheet} />
    </div>
  );
}

function ActionItem({
  icon: Icon,
  title,
  subtitle,
  tone = "default",
  onClick,
  to,
  params,
}: {
  icon: typeof UserRound;
  title: string;
  subtitle?: string;
  tone?: "default" | "primary" | "warning" | "destructive";
  onClick?: () => void;
  to?: string;
  params?: Record<string, string>;
}) {
  const toneCls =
    tone === "primary" ? "text-primary"
      : tone === "warning" ? "text-warning"
        : tone === "destructive" ? "text-destructive"
          : "text-foreground";
  const inner = (
    <>
      <Icon className={`h-5 w-5 shrink-0 ${toneCls}`} />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${toneCls}`}>{title}</p>
        {subtitle && <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>
    </>
  );
  const cls = "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left active:bg-secondary";
  if (to) {
    return (
      <Link to={to} params={params} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

function MemberActionsSheet({
  m,
  open,
  onOpenChange,
}: {
  m: MemberListItem;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();

  const setStatus = useMutation({
    mutationFn: async (status: MemberStatus) => {
      const { error } = await supabase.from("members").update({ status }).eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["member", m.id] });
      toast.success("Estado actualizado");
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("members").delete().eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
      toast.success("Miembro eliminado");
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  async function resetPassword() {
    if (!m.email) return toast.error("El miembro no tiene email registrado");
    const { error } = await supabase.auth.resetPasswordForEmail(m.email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) return toast.error(error.message);
    toast.success("Correo de restablecimiento enviado");
  }

  const isPaused = m.status === "pausado";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle className="text-base">Más acciones</DrawerTitle>
        </DrawerHeader>
        <div className="overflow-y-auto px-3 pb-8">
          <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Administración</p>
          <ActionItem icon={UserRound} title="Ver perfil" subtitle="Información completa del miembro" to="/members/$id" params={{ id: m.id }} />
          <ActionItem icon={Pencil} title="Editar información" subtitle="Datos personales y de contacto" to="/members/$id" params={{ id: m.id }} />

          <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Estado del miembro</p>
          <ActionItem icon={CircleCheck} title="Activar miembro" subtitle="El miembro podrá acceder normalmente" tone="primary" onClick={() => setStatus.mutate("activo")} />
          {isPaused ? (
            <ActionItem icon={PlayCircle} title="Reanudar membresía" subtitle="Vuelve a quedar activa desde hoy" tone="primary" onClick={() => setStatus.mutate("activo")} />
          ) : (
            <ActionItem icon={PauseCircle} title="Pausar membresía" subtitle="Congela la membresía temporalmente" tone="warning" onClick={() => setStatus.mutate("pausado")} />
          )}
          <ActionItem icon={AlertCircle} title="Suspender miembro" subtitle="Acceso temporalmente restringido" tone="warning" onClick={() => setStatus.mutate("suspendido")} />
          <ActionItem icon={Lock} title="Bloquear miembro" subtitle="El miembro no podrá iniciar sesión" tone="destructive" onClick={() => setStatus.mutate("bloqueado")} />
          <ActionItem icon={Clock} title="Marcar como vencido" subtitle="Membresía finalizada" tone="destructive" onClick={() => setStatus.mutate("vencido")} />

          <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Cuenta</p>
          <ActionItem icon={KeyRound} title="Restablecer contraseña" subtitle="Enviar nueva contraseña al miembro" onClick={resetPassword} />
          <ActionItem icon={Receipt} title="Ver pagos y facturas" subtitle="Historial de pagos y facturación" to="/members/$id" params={{ id: m.id }} />
          <ActionItem
            icon={Trash2}
            title="Eliminar miembro"
            subtitle="Eliminar miembro permanentemente"
            tone="destructive"
            onClick={() => { if (confirm(`¿Eliminar a ${m.full_name}?`)) remove.mutate(); }}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}


function SkeletonList() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl border bg-card" />
      ))}
    </>
  );
}

function AddMemberFab({ plans }: { plans: Array<{ id: string; name: string }> }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", plan_id: "" });
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("members").insert({
        full_name: form.full_name,
        email: form.email || null,
        phone: form.phone || null,
        plan_id: form.plan_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Miembro agregado");
      qc.invalidateQueries({ queryKey: ["members"] });
      setOpen(false);
      setForm({ full_name: "", email: "", phone: "", plan_id: "" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="fixed bottom-24 right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 active:scale-95 transition-transform">
          <Plus className="h-6 w-6" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader><DialogTitle>Nuevo miembro</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
          <div><Label>Nombre completo</Label><Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label>Teléfono</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div>
            <Label>Plan</Label>
            <Select value={form.plan_id} onValueChange={(v) => setForm({ ...form, plan_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecciona un plan (opcional)" /></SelectTrigger>
              <SelectContent>
                {plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={mut.isPending} className="w-full rounded-full h-11 font-semibold">
            {mut.isPending ? "Guardando..." : "Guardar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BoxInviteCard() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["box_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("box_settings").select("id, invite_code").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const regen = useMutation({
    mutationFn: async () => {
      const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
      let code = "";
      for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
      code += "-";
      for (let i = 0; i < 3; i++) code += chars[Math.floor(Math.random() * chars.length)];
      if (!data?.id) {
        const { error } = await supabase.from("box_settings").insert({ invite_code: code });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("box_settings").update({ invite_code: code }).eq("id", data.id);
        if (error) throw error;
      }
      return code;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["box_settings"] });
      toast.success("Código regenerado");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const code = data?.invite_code ?? "—";

  async function copy() {
    await navigator.clipboard.writeText(code);
    toast.success("Código copiado");
  }


  return (
    <div className="mb-4 rounded-3xl border bg-gradient-to-br from-primary/15 via-card to-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Código de invitación
        </p>
        <button
          onClick={copy}
          className="grid h-8 w-8 place-items-center rounded-lg bg-secondary text-foreground active:bg-secondary/70"
          aria-label="Copiar"
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>
      <button
        onClick={copy}
        className="mt-3 block w-full text-left font-mono text-3xl font-black tracking-[0.25em] text-primary"
      >
        {isLoading ? "…" : code}
      </button>
      <div className="mt-4">
        <Button
          onClick={() => regen.mutate()}
          disabled={regen.isPending}
          variant="secondary"
          className="h-11 w-full rounded-full font-semibold"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${regen.isPending ? "animate-spin" : ""}`} />
          Regenerar
        </Button>
      </div>
    </div>
  );
}

type Request = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
};

function PendingRequests() {
  const qc = useQueryClient();
  const { data: requests = [] } = useQuery({
    queryKey: ["member_requests", "pendiente"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_requests")
        .select("id, full_name, phone, email, created_at")
        .eq("status", "pendiente")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Request[];
    },
  });

  const approve = useMutation({
    mutationFn: async (r: Request) => {
      const { error: insErr } = await supabase.from("members").insert({
        full_name: r.full_name,
        phone: r.phone,
        email: r.email,
      });
      if (insErr) throw insErr;
      const { error } = await supabase
        .from("member_requests")
        .update({ status: "aprobado" })
        .eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["member_requests"] });
      qc.invalidateQueries({ queryKey: ["members"] });
      toast.success("Solicitud aprobada");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const reject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("member_requests")
        .update({ status: "rechazado" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["member_requests"] });
      toast.success("Solicitud rechazada");
    },
  });

  if (requests.length === 0) return null;

  return (
    <div className="mb-4 rounded-3xl border bg-card p-4">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Solicitudes pendientes ({requests.length})
      </p>
      <div className="space-y-2">
        {requests.map((r) => (
          <div key={r.id} className="flex items-center gap-3 rounded-2xl border bg-background/40 p-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-xs font-bold">
              {r.full_name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() || <User className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{r.full_name}</p>
              {(r.phone || r.email) && (
                <p className="truncate text-[11px] text-muted-foreground">{r.phone ?? r.email}</p>
              )}
            </div>
            <button
              onClick={() => approve.mutate(r)}
              disabled={approve.isPending}
              className="grid h-10 w-10 place-items-center rounded-full bg-primary/20 text-primary active:bg-primary/30 disabled:opacity-40"
              aria-label="Aprobar"
            >
              <Check className="h-5 w-5" />
            </button>
            <button
              onClick={() => reject.mutate(r.id)}
              disabled={reject.isPending}
              className="grid h-10 w-10 place-items-center rounded-full bg-destructive/15 text-destructive active:bg-destructive/25 disabled:opacity-40"
              aria-label="Rechazar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
