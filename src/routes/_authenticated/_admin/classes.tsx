import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, ChevronLeft, ChevronRight, CalendarDays, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import {
  format, addDays, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  addMonths, isSameDay, isSameMonth,
} from "date-fns";
import { es } from "date-fns/locale";
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

const DAY_LABELS = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];

const HOUR_START = 6;
const HOUR_END = 23;
const HOUR_PX = 64;
const GUTTER = 52;

export const Route = createFileRoute("/_authenticated/_admin/classes")({
  head: () => ({
    meta: [
      { title: "Clases — Dlovebox" },
      { name: "description", content: "Calendario semanal y mensual de clases y WODs del box." },
      { property: "og:title", content: "Clases — Dlovebox" },
      { property: "og:description", content: "Calendario de clases del box." },
    ],
  }),
  component: ClassesPage,
});

type ClassRow = {
  id: string;
  name: string;
  class_date: string;
  start_time: string;
  duration_minutes: number;
  capacity: number;
  level: string;
  status: string;
  coach: { full_name: string } | null;
  class_attendees: { id: string }[] | null;
};

function useClassesRange(from: Date, to: Date) {
  const f = format(from, "yyyy-MM-dd");
  const t = format(to, "yyyy-MM-dd");
  return useQuery({
    queryKey: ["classes-range", f, t],
    queryFn: async () =>
      ((await supabase
        .from("classes")
        .select("id, name, class_date, start_time, duration_minutes, capacity, level, status, coach:coach_id(full_name), class_attendees(id)")
        .gte("class_date", f)
        .lte("class_date", t)
        .order("start_time")).data ?? []) as unknown as ClassRow[],
  });
}

function ClassesPage() {
  const [mode, setMode] = useState<"semana" | "mes">("semana");
  const [selected, setSelected] = useState(new Date());

  return (
    <AdminShell title="Clases" right={<CalendarDays className="h-5 w-5 text-muted-foreground" />}>
      <div className="grid grid-cols-2 gap-1 rounded-full bg-secondary p-1">
        {(["semana", "mes"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-full py-2 text-sm font-semibold capitalize transition-colors ${
              mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {mode === "semana" ? (
        <WeekView selected={selected} onSelect={setSelected} />
      ) : (
        <MonthView selected={selected} onSelect={setSelected} />
      )}

      <AddClassFab defaultDate={format(selected, "yyyy-MM-dd")} />
    </AdminShell>
  );
}

/* ---------------- Week ---------------- */

function WeekView({ selected, onSelect }: { selected: Date; onSelect: (d: Date) => void }) {
  const weekStart = startOfWeek(selected, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selected, { weekStartsOn: 1 });
  const { data } = useClassesRange(weekStart, weekEnd);
  const dayKey = format(selected, "yyyy-MM-dd");
  const dayClasses = (data ?? []).filter((c) => c.class_date === dayKey);

  return (
    <div className="mt-4">
      <h2 className="text-xl font-black tracking-tight">Calendario</h2>

      <div className="mt-3 grid grid-cols-7 gap-1">
        {DAY_LABELS.map((lbl, i) => {
          const d = addDays(weekStart, i);
          const active = isSameDay(d, selected);
          return (
            <button key={lbl} onClick={() => onSelect(d)} className="flex flex-col items-center gap-1 py-1">
              <span className="text-[10px] font-semibold text-muted-foreground">{lbl}</span>
              <span
                className={`grid h-8 w-8 place-items-center rounded-full text-sm font-bold transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "text-foreground"
                }`}
              >
                {format(d, "d")}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 border-t border-border/60 pt-2">
        <div className="relative" style={{ height: (HOUR_END - HOUR_START + 1) * HOUR_PX }}>
          {Array.from({ length: HOUR_END - HOUR_START + 1 }).map((_, i) => (
            <div key={i} className="absolute left-0 right-0 flex gap-2" style={{ top: i * HOUR_PX }}>
              <span className="w-11 shrink-0 -translate-y-2 text-[11px] tabular-nums text-muted-foreground">
                {String(HOUR_START + i).padStart(2, "0")}:00
              </span>
              <div className="flex-1 border-t border-border/40" />
            </div>
          ))}

          {dayClasses.map((c) => {
            const [h, m] = c.start_time.split(":").map(Number);
            const top = (h + m / 60 - HOUR_START) * HOUR_PX;
            const height = Math.max(44, ((c.duration_minutes || 60) / 60) * HOUR_PX - 6);
            if (top < -HOUR_PX) return null;
            const enrolled = c.class_attendees?.length ?? 0;
            const endMin = h * 60 + m + (c.duration_minutes || 60);
            const end = `${String(Math.floor(endMin / 60) % 24).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
            return (
              <Link
                key={c.id}
                to="/classes/$id"
                params={{ id: c.id }}
                className="absolute right-0 flex flex-col justify-center rounded-2xl border border-primary/40 bg-primary/15 px-3 py-2 active:scale-[0.99]"
                style={{ top, height, left: 52 }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-bold">{c.name}</p>
                  <span className="shrink-0 text-[11px] font-bold text-primary">{enrolled}/{c.capacity}</span>
                </div>
                <p className="truncate text-[11px] text-muted-foreground">
                  {c.start_time.slice(0, 5)} - {end}
                  {c.coach?.full_name ? ` · ${c.coach.full_name}` : ""}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Month ---------------- */

function MonthView({ selected, onSelect }: { selected: Date; onSelect: (d: Date) => void }) {
  const [cursor, setCursor] = useState(startOfMonth(selected));
  const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
  const { data } = useClassesRange(gridStart, gridEnd);
  const withClasses = new Set((data ?? []).map((c) => c.class_date));
  const dayKey = format(selected, "yyyy-MM-dd");
  const dayClasses = (data ?? []).filter((c) => c.class_date === dayKey);

  const cells: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) cells.push(d);

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <button onClick={() => setCursor(addMonths(cursor, -1))} className="grid h-9 w-9 place-items-center rounded-full bg-secondary">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-base font-black capitalize">{format(cursor, "MMMM yyyy", { locale: es })}</p>
        <button onClick={() => setCursor(addMonths(cursor, 1))} className="grid h-9 w-9 place-items-center rounded-full bg-secondary">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-y-1 text-center">
        {DAY_LABELS.map((l) => (
          <span key={l} className="text-[10px] font-semibold text-muted-foreground">{l}</span>
        ))}
        {cells.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const active = isSameDay(d, selected);
          const inMonth = isSameMonth(d, cursor);
          return (
            <button key={key} onClick={() => onSelect(d)} className="flex flex-col items-center py-1">
              <span
                className={`grid h-9 w-9 place-items-center rounded-full text-sm font-semibold transition-colors ${
                  active ? "bg-primary text-primary-foreground" : inMonth ? "text-foreground" : "text-muted-foreground/40"
                }`}
              >
                {format(d, "d")}
              </span>
              <span className={`mt-0.5 h-1 w-1 rounded-full ${withClasses.has(key) && !active ? "bg-primary" : "bg-transparent"}`} />
            </button>
          );
        })}
      </div>

      <h3 className="mt-5 text-sm font-bold">
        Clases · <span className="capitalize">{format(selected, "EEEE d 'de' MMMM", { locale: es })}</span>
      </h3>
      <div className="mt-2 space-y-2">
        {dayClasses.length === 0 && (
          <p className="rounded-2xl border border-dashed p-4 text-center text-xs text-muted-foreground">Sin clases este día</p>
        )}
        {dayClasses.slice(0, 3).map((c) => (
          <ClassCard key={c.id} c={c} />
        ))}
      </div>
      {dayClasses.length > 0 && (
        <Link
          to="/classes/$id"
          params={{ id: dayClasses[0].id }}
          className="mt-3 flex items-center justify-between text-xs font-semibold text-primary"
        >
          Ver todas las clases del día <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

function ClassCard({ c }: { c: ClassRow }) {
  const enrolled = c.class_attendees?.length ?? 0;
  const [h, m] = c.start_time.split(":").map(Number);
  const endMin = h * 60 + m + (c.duration_minutes || 60);
  const end = `${String(Math.floor(endMin / 60) % 24).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
  return (
    <Link
      to="/classes/$id"
      params={{ id: c.id }}
      className="flex items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-3 active:scale-[0.99]"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-bold">{c.name}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {c.start_time.slice(0, 5)} - {end}
        </p>
        {c.coach?.full_name && <p className="truncate text-[11px] text-muted-foreground">{c.coach.full_name}</p>}
      </div>
      <span className="shrink-0 text-xs font-bold text-primary">{enrolled}/{c.capacity}</span>
    </Link>
  );
}

/* ---------------- Create ---------------- */

function AddClassFab({ defaultDate }: { defaultDate: string }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    class_date: defaultDate,
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
    if (v) {
      setForm((f) => ({ ...f, class_date: defaultDate }));
      setSelectedDays([baseDow]);
    }
  };

  const { data: coaches } = useQuery({
    queryKey: ["coaches"],
    queryFn: async () => (await supabase.from("coaches").select("id, full_name").order("full_name")).data ?? [],
  });
  const mut = useMutation({
    mutationFn: async () => {
      const base = parseISO(form.class_date);
      const common = {
        name: form.name,
        start_time: form.start_time,
        duration_minutes: form.duration_minutes,
        capacity: form.capacity,
        level: form.level as "todos",
        coach_id: form.coach_id || null,
      };
      const rows: Array<typeof common & { class_date: string }> = [];
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
    onSuccess: (n) => { toast.success(n > 1 ? `${n} clases creadas` : "Clase creada"); qc.invalidateQueries({ queryKey: ["classes-range"] }); setOpen(false); },
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
