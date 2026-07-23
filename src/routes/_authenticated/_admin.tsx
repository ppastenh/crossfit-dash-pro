import { createFileRoute, Outlet, redirect, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ShieldAlert, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

async function getIsAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) return false;
  return !!data;
}

export const Route = createFileRoute("/_authenticated/_admin")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    const user = (context as { user?: { id: string } }).user;
    if (!user) throw redirect({ to: "/auth" });
    const isAdmin = await getIsAdmin(user.id);
    return { isAdmin };
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { isAdmin } = Route.useRouteContext();
  if (!isAdmin) return <NoAccess />;
  return <Outlet />;
}

function NoAccess() {
  async function onSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-destructive/15 text-destructive">
        <ShieldAlert className="h-8 w-8" />
      </div>
      <h1 className="mt-4 text-xl font-bold">Acceso restringido</h1>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        Tu cuenta no tiene permisos de administrador. Contacta al administrador del box para solicitar acceso.
      </p>
      <Button variant="outline" onClick={onSignOut} className="mt-6 rounded-full">
        <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
      </Button>
      <Link to="/auth" className="mt-4 text-xs text-muted-foreground underline">
        Volver al inicio de sesión
      </Link>
    </div>
  );
}
