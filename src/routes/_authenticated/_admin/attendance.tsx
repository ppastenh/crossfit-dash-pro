import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Search, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar } from "./members";
import { toast } from "sonner";
import { format, subDays, startOfDay } from "date-fns";
import { es } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/_admin/attendance")({
  head: () => ({
    meta: [
      { title: "Asistencia — Dlovebox" },
      { name: "description", content: "Check-in de miembros, historial y estadísticas semanales." },
      { property: "og:title", content: "Asistencia — Dlovebox" },
      { property: "og:description", content: "Check-in y asistencia diaria." },
    ],
  }),
  component: AttendancePage,
});

function AttendancePage() {
  const [q, setQ] = useState("");
  const qc = useQueryClient();
  const todayStart = startOfDay(new Date()).toISOString();

  const search = useQuery({
    queryKey: ["att-members", q],
    queryFn: async () => (await supabase.from("members").select("id, full_name, photo_url").ilike("full_name", `%${q}%`).eq("status", "activo").limit(8)).data ?? [],
    enabled: q.length > 0,
  });

  const todayList = useQuery({
    queryKey: ["att-today"],
    queryFn: async () => (await supabase
      .from("attendance")
      .select("id, checked_in_at, member:member_id(id, full_name, photo_url)")
      .gte("checked_in_at", todayStart)
      .order("checked_in_at", { ascending: false })).data ?? [],
  });

  const weekly = useQuery({
    queryKey: ["att-weekly"],
    queryFn: async () => {
      const from = subDays(new Date(), 6);
      const { data } = await supabase
        .from("attendance")
        .select("checked_in_at")
        .gte("checked_in_at", from.toISOString());
      const buckets: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = format(subDays(new Date(), i), "yyyy-MM-dd");
        buckets[d] = 0;
      }
      (data ?? []).forEach((r) => {
        const d = format(new Date(r.checked_in_at), "yyyy-MM-dd");
        if (buckets[d] !== undefined) buckets[d]++;
      });
      return Object.entries(buckets).map(([date, count]) => ({ date, count }));
    },
  });

  const checkin = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from("attendance").insert({ member_id: memberId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Check-in registrado"); qc.invalidateQueries({ queryKey: ["att-today"] }); qc.invalidateQueries({ queryKey: ["att-weekly"] }); setQ(""); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const max = Math.max(1, ...(weekly.data ?? []).map((d) => d.count));

  return (
    <AdminShell title="Asistencia">
      <div className="rounded-3xl border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Check-in rápido</p>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar miembro..." className="pl-9 rounded-full h-11" />
        </div>
        {q && (
          <div className="mt-2 space-y-1">
            {(search.data ?? []).map((m) => (
              <button key={m.id} onClick={() => checkin.mutate(m.id)}
                className="flex w-full items-center gap-3 rounded-xl bg-secondary p-2 active:scale-[0.99] transition-transform">
                <Avatar name={m.full_name} url={m.photo_url} size={32} />
                <span className="flex-1 text-left text-sm">{m.full_name}</span>
                <Check className="h-4 w-4 text-primary" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">Últimos 7 días</h2>
        <div className="rounded-3xl border bg-card p-4">
          <div className="flex h-32 items-end gap-1.5">
            {(weekly.data ?? []).map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex w-full flex-1 items-end">
                  <div className="w-full rounded-t-md bg-primary/80"
                    style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? 4 : 0 }} />
                </div>
                <span className="text-[9px] text-muted-foreground">{format(new Date(d.date), "EEEEEE", { locale: es })}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">Asistieron hoy · {todayList.data?.length ?? 0}</h2>
        <div className="space-y-2">
          {todayList.data?.length === 0 && <p className="rounded-2xl border border-dashed p-4 text-center text-xs text-muted-foreground">Nadie ha marcado asistencia hoy</p>}
          {todayList.data?.map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
              <Avatar name={a.member?.full_name ?? "?"} url={a.member?.photo_url} size={36} />
              <p className="min-w-0 flex-1 truncate text-sm font-medium">{a.member?.full_name}</p>
              <p className="text-xs text-muted-foreground">{format(new Date(a.checked_in_at), "HH:mm")}</p>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
