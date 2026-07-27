import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FileText, FileImage, FileType2, Upload, RefreshCw, Trash2, Plus, ExternalLink, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_admin/more/files")({
  head: () => ({
    meta: [
      { title: "Archivos — Dlovebox" },
      { name: "description", content: "Contratos y documentos generales para los atletas." },
      { property: "og:title", content: "Archivos — Dlovebox" },
      { property: "og:description", content: "Sube y gestiona contratos que ven los atletas." },
    ],
  }),
  component: FilesPage,
});

const ACCEPT = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*";
const MAX_MB = 20;

type Contract = {
  id: string;
  title: string;
  doc_type: string;
  file_name: string;
  mime_type: string;
  storage_path: string;
  created_at: string;
  updated_at: string;
};

function iconFor(mime: string) {
  if (mime.startsWith("image/")) return FileImage;
  if (mime.includes("pdf")) return FileType2;
  return FileText;
}

async function fetchContracts() {
  const { data, error } = await supabase.from("contracts").select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Contract[];
}

async function fetchStats() {
  const [{ count: total }, { data: acc }] = await Promise.all([
    supabase.from("members").select("*", { count: "exact", head: true }),
    supabase.from("contract_acceptances").select("contract_id"),
  ]);
  const counts = new Map<string, number>();
  for (const row of acc ?? []) counts.set(row.contract_id, (counts.get(row.contract_id) ?? 0) + 1);
  return { totalMembers: total ?? 0, byContract: counts };
}

function FilesPage() {
  const qc = useQueryClient();
  const { data: contracts = [], isLoading } = useQuery({ queryKey: ["contracts"], queryFn: fetchContracts });
  const { data: stats } = useQuery({ queryKey: ["contract-stats"], queryFn: fetchStats });
  const [open, setOpen] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["contracts"] });
    qc.invalidateQueries({ queryKey: ["contract-stats"] });
  };

  return (
    <AdminShell title="Archivos" showBack right={
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground">
            <Plus className="h-4 w-4" />
          </button>
        </DialogTrigger>
        <UploadDialog onDone={() => { setOpen(false); invalidate(); }} />
      </Dialog>
    }>
      <div className="mb-4 rounded-2xl border bg-card p-4">
        <p className="text-xs text-muted-foreground">Contratos generales</p>
        <p className="mt-1 text-sm">Los archivos aquí se muestran a todos los atletas en <span className="font-semibold">Contratos Activos</span>. Al reemplazar un archivo, se resetea la aceptación y se bloquea el agendamiento hasta que lo acepten.</p>
      </div>

      {isLoading ? (
        <p className="text-center text-xs text-muted-foreground">Cargando…</p>
      ) : contracts.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed p-10 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-muted-foreground">
            <Upload className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-bold">Sin archivos</h2>
          <p className="mt-2 max-w-xs text-xs text-muted-foreground">Sube tu primer contrato para que aparezca en la app de los atletas.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {contracts.map((c) => (
            <ContractRow key={c.id} contract={c} accepted={stats?.byContract.get(c.id) ?? 0} total={stats?.totalMembers ?? 0} onChange={invalidate} />
          ))}
        </ul>
      )}
    </AdminShell>
  );
}

function ContractRow({ contract, accepted, total, onChange }: { contract: Contract; accepted: number; total: number; onChange: () => void }) {
  const Icon = iconFor(contract.mime_type);
  const replaceRef = useRef<HTMLInputElement>(null);

  const replaceMut = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > MAX_MB * 1024 * 1024) throw new Error(`Máx ${MAX_MB}MB`);
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${contract.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("contracts").upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from("contracts").update({
        file_name: file.name, mime_type: file.type || "application/octet-stream", storage_path: path,
      }).eq("id", contract.id);
      if (dbErr) throw dbErr;
      await supabase.storage.from("contracts").remove([contract.storage_path]).catch(() => {});
    },
    onSuccess: () => { toast.success("Archivo reemplazado. Los atletas deben aceptar de nuevo."); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      await supabase.storage.from("contracts").remove([contract.storage_path]).catch(() => {});
      const { error } = await supabase.from("contracts").delete().eq("id", contract.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Archivo eliminado"); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function openFile() {
    const { data, error } = await supabase.storage.from("contracts").createSignedUrl(contract.storage_path, 60);
    if (error || !data) return toast.error("No se pudo abrir");
    window.open(data.signedUrl, "_blank", "noopener");
  }

  const pct = total > 0 ? Math.round((accepted / total) * 100) : 0;

  return (
    <li className="rounded-3xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{contract.title}</p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{contract.doc_type} · {contract.file_name}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Actualizado {new Date(contract.updated_at).toLocaleDateString()}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-2xl bg-secondary/60 px-3 py-2">
        <Users className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-semibold">{accepted}/{total} aceptaron</span>
        <div className="ml-auto h-1.5 w-20 overflow-hidden rounded-full bg-background">
          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Button variant="secondary" size="sm" className="rounded-xl" onClick={openFile}>
          <ExternalLink className="mr-1 h-3.5 w-3.5" /> Ver
        </Button>
        <Button variant="secondary" size="sm" className="rounded-xl" onClick={() => replaceRef.current?.click()} disabled={replaceMut.isPending}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> {replaceMut.isPending ? "…" : "Reemplazar"}
        </Button>
        <Button variant="ghost" size="sm" className="rounded-xl text-destructive" onClick={() => { if (confirm("¿Eliminar este archivo?")) deleteMut.mutate(); }}>
          <Trash2 className="mr-1 h-3.5 w-3.5" /> Borrar
        </Button>
      </div>
      <input ref={replaceRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) replaceMut.mutate(f); e.target.value = ""; }} />
    </li>
  );
}

function UploadDialog({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("Contrato");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!title.trim()) return toast.error("Título requerido");
    if (!file) return toast.error("Selecciona un archivo");
    if (file.size > MAX_MB * 1024 * 1024) return toast.error(`Máx ${MAX_MB}MB`);
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: row, error: insErr } = await supabase.from("contracts").insert({
        title: title.trim(), doc_type: docType, file_name: file.name,
        mime_type: file.type || "application/octet-stream", storage_path: "pending",
        uploaded_by: userData.user?.id ?? null,
      }).select("id").single();
      if (insErr || !row) throw insErr ?? new Error("Error");
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${row.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("contracts").upload(path, file, { contentType: file.type });
      if (upErr) { await supabase.from("contracts").delete().eq("id", row.id); throw upErr; }
      const { error: updErr } = await supabase.from("contracts").update({ storage_path: path }).eq("id", row.id);
      if (updErr) throw updErr;
      toast.success("Archivo subido. Se notificará a los atletas.");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al subir");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogContent className="max-w-sm rounded-3xl">
      <DialogHeader><DialogTitle>Subir archivo</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="title" className="text-xs">Título visible</Label>
          <Input id="title" placeholder="Contrato de Membresía" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Tipo</Label>
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Contrato">Contrato</SelectItem>
              <SelectItem value="Reglamento">Reglamento</SelectItem>
              <SelectItem value="Aviso">Aviso</SelectItem>
              <SelectItem value="Otro">Otro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="file" className="text-xs">Archivo (PDF, Word, imagen · máx {MAX_MB}MB)</Label>
          <Input id="file" type="file" accept={ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={busy} className="w-full rounded-xl">
          {busy ? "Subiendo…" : "Subir"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
