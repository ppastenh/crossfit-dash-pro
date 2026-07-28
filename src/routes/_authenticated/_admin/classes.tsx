import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Clock, User as UserIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { format, addDays, parseISO } from "date-fns";
import { toast } from "sonner";

const WEEK_DAYS = [
  { label: "L", value: 1 },
  { label: "M", value: 2 },
  { label: "M", value: 3 },
  { label: "J", value: 4 },
  { label: "V", value: 5 },
  { label: "S", value: 6 },
  { label: "D", value: 0 },
];

export const Route = createFileRoute("/_authenticated/_admin/classes")({
  head: () => ({
    meta: [
      { title: "Clases — Dlovebox" },
      { name: "description", content: "Programación y gestión de clases y WODs del día." },
      { property: "og:title", content: "Clases — Dlovebox" },
      { property: "og:description", content: "Clases del día y programación." },
    ],
  }),
  component: ClassesPage,
});

const levelColors: Record<string, string> = {
  principiante: "bg-success/20 text-success",
  intermedio: "bg-warning/20 text-warning",
  avanzado: "bg-destructive/20 text-destructive",
  todos: "bg-secondary text-foreground",
};

function ClassesPage() {
  const today = format(new Date(), "yyyy-MM-dd");
  const classes = useQuery({
    queryKey: ["classes-today", today],
    queryFn: async () => (
      await supabase
        .from("classes")
        .select("id, name, start_time, capacity, level, status, coach:coach_id(full_name), class_attendees(id)")
        .eq("class_date", today)
        .order("start_time")
    ).data ?? [],
  });

  return (
    <AdminShell title="Clases">
      <p className="mb-4 text-xs uppercase tracking-widest text-muted-foreground">Hoy · {format(new Date(), "dd MMM yyyy")}</p>
      <div className="space-y-3">
        {classes.data?.length === 0 && (
          <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No hay clases hoy. Crea la primera con el botón +
          </div>
        )}
        {classes.data?.map((c) => {
          const enrolled = c.class_attendees?.length ?? 0;
          const pct = c.capacity ? Math.min(100, (enrolled / c.capacity) * 100) : 0;
          return (
            <Link key={c.id} to="/classes/$id" params={{ id: c.id }} className="block rounded-3xl border bg-card p-4 active:scale-[0.99] transition-transform">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-bold">{c.name}</h3>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{c.start_time?.slice(0, 5)}</span>
                    {c.coach?.full_name && <span className="flex items-center gap-1"><UserIcon className="h-3 w-3" />{c.coach.full_name}</span>}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${levelColors[c.level] ?? "bg-secondary"}`}>{c.level}</span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs font-bold">{enrolled}/{c.capacity}</span>
              </div>
            </Link>
          );
        })}
      </div>

      <AddClassFab />
    </AdminShell>
  );
}

function AddClassFab() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    class_date: format(new Date(), "yyyy-MM-dd"),
    start_time: "07:00",
    duration_minutes: 60,
    capacity: 15,
    level: "todos" as string,
    coach_id: "",
  });
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [weeksAhead, setWeeksAhead] = useState(8);

  const baseDow = (() => {
    try { return parseISO(form.class_date).getDay(); } catch { return new Date().getDay(); }
  })();

  const toggleDay = (d: number) => {
    setSelectedDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
  };

  const openChange = (v: boolean) => {
    setOpen(v);
    if (v) setSelectedDays([baseDow]);
  };

  const { data: coaches } = useQuery({
    queryKey: ["coaches"],
    queryFn: async () => (await supabase.from("coaches").select("id, full_name").order("full_name")).data ?? [],
  });
  const mut = useMutation({
    mutationFn: async () => {
      const base = parseISO(form.class_date);
      const rows: Array<typeof common & { class_date: string }> = [];
      const common = {
        name: form.name,
        start_time: form.start_time,
        duration_minutes: form.duration_minutes,
        capacity: form.capacity,
        level: form.level as "todos",
        coach_id: form.coach_id || null,
      };
      if (repeatWeekly && selectedDays.length > 0) {
        const seen = new Set<string>();
        for (let w = 0; w < weeksAhead; w++) {
          for (const dow of selectedDays) {
            const weekStart = addDays(base, w * 7);
            const diff = (dow - weekStart.getDay() + 7) % 7;
            const d = addDays(weekStart, diff);
            if (d < base) continue;
            const key = format(d, "yyyy-MM-dd");
            if (seen.has(key)) continue;
            seen.add(key);
            rows.push({ ...common, class_date: key });
          }
        }
      } else {
        rows.push({ ...common, class_date: form.class_date });
      }
      const { error } = await supabase.from("classes").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => { toast.success(n > 1 ? `${n} clases creadas` : "Clase creada"); qc.invalidateQueries({ queryKey: ["classes-today"] }); setOpen(false); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  return (
    <Dialog open={open} onOpenChange={openChange}>
      <DialogTrigger asChild>
        <button className="fixed bottom-24 right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30">
          <Plus className="h-6 w-6" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader><DialogTitle>Nueva clase</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
          <div><Label>WOD / Nombre</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Fecha</Label><Input type="date" value={form.class_date} onChange={(e) => setForm({ ...form, class_date: e.target.value })} /></div>
            <div><Label>Hora</Label><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Duración (min)</Label><Input type="number" min={5} step={5} value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} /></div>
            <div><Label>Cupos</Label><Input type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} /></div>
          </div>
          <div>
            <Label>Nivel</Label>
            <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="principiante">Principiante</SelectItem>
                <SelectItem value="intermedio">Intermedio</SelectItem>
                <SelectItem value="avanzado">Avanzado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Coach</Label>
            <Select value={form.coach_id} onValueChange={(v) => setForm({ ...form, coach_id: v })}>
              <SelectTrigger><SelectValue placeholder="(opcional)" /></SelectTrigger>
              <SelectContent>
                {(coaches ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-2xl border p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Label className="text-sm">Repetir esta clase semanalmente</Label>
                <p className="text-xs text-muted-foreground">Crea la clase en los días elegidos</p>
              </div>
              <Switch checked={repeatWeekly} onCheckedChange={setRepeatWeekly} />
            </div>
            {repeatWeekly && (
              <>
                <div className="flex justify-between gap-1">
                  {WEEK_DAYS.map((d, i) => {
                    const active = selectedDays.includes(d.value);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleDay(d.value)}
                        className={`h-10 w-10 rounded-full text-sm font-semibold transition-colors ${
                          active
                            ? "bg-primary text-primary-foreground border border-primary"
                            : "border border-border text-foreground"
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
                <div>
                  <Label className="text-xs">Repetir por (semanas)</Label>
                  <Input type="number" min={1} max={52} value={weeksAhead} onChange={(e) => setWeeksAhead(Math.max(1, Number(e.target.value)))} />
                </div>
              </>
            )}
          </div>
          <Button type="submit" disabled={mut.isPending} className="w-full rounded-full h-11 font-semibold">
            {mut.isPending ? "Guardando..." : "Crear clase"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
