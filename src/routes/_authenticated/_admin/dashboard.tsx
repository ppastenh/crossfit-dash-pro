import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { MetricCard } from "@/components/admin/MetricCard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, CalendarDays, DollarSign, AlertTriangle, Plus, CreditCard, Dumbbell, UserPlus, ChevronRight, Megaphone } from "lucide-react";
import { format, startOfMonth, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";


export const Route = createFileRoute("/_authenticated/_admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Dlovebox" },
      { name: "description", content: "Resumen del box: miembros activos, clases del día, ingresos y actividad reciente." },
      { property: "og:title", content: "Dashboard — Dlovebox" },
      { property: "og:description", content: "Panel principal de gestión del box." },
    ],
  }),
  component: DashboardPage,
});

function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const in7days = format(addDays(new Date(), 7), "yyyy-MM-dd");

      const [total, active, todayClasses, monthRevenue, expiring] = await Promise.all([
        supabase.from("members").select("id", { count: "exact", head: true }),
        supabase.from("members").select("id", { count: "exact", head: true }).eq("status", "activo"),
        supabase.from("classes").select("id", { count: "exact", head: true }).eq("class_date", today),
        supabase.from("payments").select("amount").eq("status", "pagado").gte("paid_at", monthStart),
        supabase.from("members").select("id", { count: "exact", head: true }).lte("next_payment", in7days).gte("next_payment", today),
      ]);

      const revenue = (monthRevenue.data ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);

      return {
        total: total.count ?? 0,
        active: active.count ?? 0,
        todayClasses: todayClasses.count ?? 0,
        revenue,
        expiring: expiring.count ?? 0,
      };
    },
  });
}

function useExpiringMembers(enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: ["expiring-members"],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const in7days = format(addDays(new Date(), 7), "yyyy-MM-dd");
      const { data } = await supabase
        .from("members")
        .select("id, full_name, status, next_payment, plans(name)")
        .gte("next_payment", today)
        .lte("next_payment", in7days)
        .order("next_payment", { ascending: true });
      return data ?? [];
    },
  });
}


function useUpcomingClasses() {
  return useQuery({
    queryKey: ["upcoming-classes"],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data } = await supabase
        .from("classes")
        .select("id, name, start_time, capacity, class_attendees(id)")
        .eq("class_date", today)
        .order("start_time", { ascending: true })
        .limit(4);
      return data ?? [];
    },
  });
}

function DashboardPage() {
  const stats = useDashboardStats();
  const upcoming = useUpcomingClasses();
  const [expOpen, setExpOpen] = useState(false);
  const expiring = useExpiringMembers(expOpen);
  const s = stats.data;

  return (
    <AdminShell>
      <div className="mb-5">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
        </p>
        <h1 className="mt-1 text-2xl font-black">Hola, admin 👋</h1>
        <p className="text-sm text-muted-foreground">Resumen de tu box hoy</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MetricCard icon={Users} label="Total de alumnos" value={s?.total ?? "—"} accent />
        <MetricCard icon={Users} label="Miembros activos" value={s?.active ?? "—"} />
        <MetricCard icon={CalendarDays} label="Clases hoy" value={s?.todayClasses ?? "—"} />
        <MetricCard icon={DollarSign} label="Ingresos del mes" value={s ? `$${s.revenue.toLocaleString()}` : "—"} />
      </div>

      <button
        onClick={() => setExpOpen(true)}
        className="mt-3 flex w-full items-center gap-3 rounded-3xl border border-amber-500/30 bg-amber-500/10 p-4 text-left active:scale-[0.99] transition-transform"
      >
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/20 text-amber-400">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">Por vencer</div>
          <div className="text-[11px] text-muted-foreground">Próximos 7 días · toca para ver la lista</div>
        </div>
        <div className="text-xl font-black">{s?.expiring ?? "—"}</div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>

      <Dialog open={expOpen} onOpenChange={setExpOpen}>
        <DialogContent className="max-w-[92vw] rounded-3xl">
          <DialogHeader>
            <DialogTitle>Membresías por vencer</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {expiring.isLoading && <p className="text-xs text-muted-foreground">Cargando…</p>}
            {!expiring.isLoading && (expiring.data ?? []).length === 0 && (
              <p className="rounded-2xl border border-dashed p-4 text-center text-xs text-muted-foreground">
                No hay membresías por vencer en los próximos 7 días
              </p>
            )}
            {(expiring.data ?? []).map((m) => (
              <Link
                key={m.id}
                to="/members/$id"
                params={{ id: m.id }}
                onClick={() => setExpOpen(false)}
                className="flex items-center gap-3 rounded-2xl border bg-card p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{m.full_name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {(m as { plans?: { name?: string } | null }).plans?.name ?? "Sin plan"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs font-bold text-amber-400">
                    {m.next_payment ? format(new Date(`${m.next_payment}T00:00:00`), "d MMM", { locale: es }) : "—"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">vence</div>
                </div>
              </Link>
            ))}
          </div>
        </DialogContent>
      </Dialog>


      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Próximas clases</h2>
          <Link to="/classes" className="text-xs font-semibold text-primary">Ver todas</Link>
        </div>
        <div className="space-y-2">
          {(upcoming.data ?? []).length === 0 && (
            <div className="rounded-2xl border border-dashed p-4 text-center text-xs text-muted-foreground">
              No hay clases programadas hoy
            </div>
          )}
          {(upcoming.data ?? []).map((c) => {
            const enrolled = c.class_attendees?.length ?? 0;
            const pct = c.capacity ? Math.min(100, (enrolled / c.capacity) * 100) : 0;
            return (
              <Link to="/classes/$id" params={{ id: c.id }} key={c.id}
                className="block rounded-2xl border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Dumbbell className="h-4 w-4 text-primary" />
                      <p className="truncate text-sm font-semibold">{c.name}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{c.start_time?.slice(0, 5)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold">{enrolled}/{c.capacity}</div>
                    <div className="text-[10px] text-muted-foreground">cupos</div>
                  </div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-muted-foreground">Acciones rápidas</h2>
        <div className="grid grid-cols-2 gap-3">
          <QuickAction to="/members" icon={UserPlus} label="Agregar miembro" />
          <QuickAction to="/classes" icon={CalendarDays} label="Crear clase" />
          <QuickAction to="/finances" icon={CreditCard} label="Registrar pago" />
          <QuickAction to="/more/notifications" icon={Megaphone} label="Enviar aviso" />
        </div>
      </section>
    </AdminShell>
  );
}

function QuickAction({ to, icon: Icon, label }: { to: string; icon: typeof Plus; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-2xl border bg-card p-3 active:scale-[0.98] transition-transform">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-sm font-semibold leading-tight">{label}</span>
    </Link>
  );
}
