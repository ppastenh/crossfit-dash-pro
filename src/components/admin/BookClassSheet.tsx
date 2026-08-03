import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Clock, User as UserIcon, CalendarDays, Check } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

type Cls = {
  id: string;
  name: string;
  class_date: string;
  start_time: string;
  capacity: number;
  coach: { full_name: string } | null;
  class_attendees: { id: string; member_id: string }[] | null;
};

export function BookClassSheet({
  memberId,
  memberName,
  open,
  onOpenChange,
}: {
  memberId: string;
  memberName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [q, setQ] = useState("");
  const qc = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");

  const classes = useQuery({
    queryKey: ["bookable-classes", today],
    enabled: open,
    queryFn: async () =>
      ((await supabase
        .from("classes")
        .select("id, name, class_date, start_time, capacity, coach:coach_id(full_name), class_attendees(id, member_id)")
        .gte("class_date", today)
        .order("class_date")
        .order("start_time")
        .limit(80)).data ?? []) as unknown as Cls[],
  });

  const book = useMutation({
    mutationFn: async ({ classId, waitlist }: { classId: string; waitlist: boolean }) => {
      const { error } = await supabase.from("class_attendees").insert({
        class_id: classId,
        member_id: memberId,
        status: waitlist ? "lista_espera" : "inscrito",
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.waitlist ? "Agregado como sobrecupo" : "Reservado");
      qc.invalidateQueries({ queryKey: ["bookable-classes"] });
      qc.invalidateQueries({ queryKey: ["class-attendees"] });
      qc.invalidateQueries({ queryKey: ["classes-range"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const list = (classes.data ?? []).filter((c) =>
    (c.name + " " + (c.coach?.full_name ?? "")).toLowerCase().includes(q.toLowerCase())
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-3xl">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-base">Reservar clase · {memberName}</DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-[max(env(safe-area-inset-bottom),16px)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar clase o coach..." className="h-11 rounded-full pl-9" />
          </div>

          <div className="mt-3 max-h-[55vh] space-y-2 overflow-y-auto pb-2">
            {classes.isLoading && <p className="py-6 text-center text-xs text-muted-foreground">Cargando...</p>}
            {!classes.isLoading && list.length === 0 && (
              <p className="rounded-2xl border border-dashed p-4 text-center text-xs text-muted-foreground">Sin clases disponibles</p>
            )}
            {list.map((c) => {
              const attendees = c.class_attendees ?? [];
              const enrolled = attendees.length;
              const already = attendees.some((a) => a.member_id === memberId);
              const full = enrolled >= (c.capacity ?? 0);
              return (
                <div key={c.id} className="rounded-2xl border bg-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{c.name}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {format(parseISO(c.class_date), "EEE d MMM", { locale: es })}
                        </span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{String(c.start_time).slice(0, 5)}</span>
                        {c.coach?.full_name && <span className="flex items-center gap-1"><UserIcon className="h-3 w-3" />{c.coach.full_name}</span>}
                      </div>
                    </div>
                    <span className={`shrink-0 text-xs font-bold ${full ? "text-destructive" : "text-primary"}`}>
                      {enrolled}/{c.capacity}
                    </span>
                  </div>

                  <div className="mt-2">
                    {already ? (
                      <p className="flex items-center gap-1 text-[11px] font-semibold text-primary">
                        <Check className="h-3.5 w-3.5" /> Ya inscrito
                      </p>
                    ) : full ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={book.isPending}
                        onClick={() => book.mutate({ classId: c.id, waitlist: true })}
                        className="h-9 w-full rounded-full text-xs"
                      >
                        Agregar como sobrecupo
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={book.isPending}
                        onClick={() => book.mutate({ classId: c.id, waitlist: false })}
                        className="h-9 w-full rounded-full text-xs font-semibold"
                      >
                        Reservar
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
