import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { Construction } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_admin/more/notifications")({
  head: () => ({ meta: [{ title: "Notificaciones — Dlovebox" }, { name: "description", content: "Notificaciones del box." }, { property: "og:title", content: "Notificaciones — Dlovebox" }, { property: "og:description", content: "Notificaciones." }] }),
  component: () => (
    <AdminShell title="Notificaciones" showBack>
      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed p-10 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-muted-foreground"><Construction className="h-6 w-6" /></div>
        <h2 className="mt-4 text-lg font-bold">Notificaciones</h2>
        <p className="mt-2 max-w-xs text-xs text-muted-foreground">Próximamente.</p>
      </div>
    </AdminShell>
  ),
});
