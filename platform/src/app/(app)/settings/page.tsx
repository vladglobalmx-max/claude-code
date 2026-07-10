import { getCurrentUser } from "@/lib/auth/session";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default async function SettingsPage() {
  const user = await getCurrentUser();

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Configuración</h1>
        <p className="text-sm text-ink-faint">Tu perfil dentro de GAIOS.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-faint">Nombre</span>
            <span className="text-ink">{user?.fullName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-faint">Correo</span>
            <span className="text-ink">{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-faint">Rol</span>
            <span className="text-ink">{user?.role}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
