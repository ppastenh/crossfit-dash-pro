import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { Construction } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_admin/more/files")({
  head: () => ({ meta: [{ title: "Archivos — Dlovebox" }, { name: "description", content: "Archivos y documentos." }, { property: "og:title", content: "Archivos — Dlovebox" }, { property: "og:description", content: "Archivos." }] }),
  component: () => (
    <AdminShell title="Archivos" showBack>
      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed p-10 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-muted-foreground"><Construction className="h-6 w-6" /></div>
        <h2 className="mt-4 text-lg font-bold">Archivos</h2>
        <p className="mt-2 max-w-xs text-xs text-muted-foreground">Próximamente.</p>
      </div>
    </AdminShell>
  ),
});
