import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Dumbbell } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Dlovebox — Acceso" },
      { name: "description", content: "Inicia sesión o crea tu cuenta de administrador Dlovebox." },
      { property: "og:title", content: "Dlovebox — Acceso" },
      { property: "og:description", content: "Acceso al panel de administración." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: name },
          },
        });
        if (error) throw error;
        toast.success("Cuenta creada. Revisa tu correo si tu proyecto lo requiere.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/dashboard" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-10">
      <div className="mb-8 flex flex-col items-center">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
          <Dumbbell className="h-8 w-8" />
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-tight">Dlovebox</h1>
        <p className="text-sm text-muted-foreground">Panel de administración</p>
      </div>

      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-3xl border bg-card p-6">
        <div className="flex rounded-full bg-secondary p-1 text-sm">
          <button type="button" onClick={() => setMode("signin")}
            className={`flex-1 rounded-full py-2 font-medium ${mode === "signin" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            Iniciar sesión
          </button>
          <button type="button" onClick={() => setMode("signup")}
            className={`flex-1 rounded-full py-2 font-medium ${mode === "signup" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            Crear cuenta
          </button>
        </div>

        {mode === "signup" && (
          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
        </div>

        <Button type="submit" disabled={loading} className="w-full rounded-full h-12 font-semibold">
          {loading ? "Cargando..." : mode === "signin" ? "Ingresar" : "Crear cuenta"}
        </Button>

        {mode === "signup" && (
          <p className="text-center text-xs text-muted-foreground">
            El primer usuario se convierte automáticamente en administrador.
          </p>
        )}
      </form>
    </div>
  );
}
