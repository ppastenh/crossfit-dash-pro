
# Panel de Administración CrossFit — Dlovebox

App mobile-first en modo oscuro con acento verde lima (#C6FF3B), inspirada en Notion/Linear/Fitbod. Solo panel admin. Vista optimizada para móvil (preview se cambia a mobile).

## 1. Backend (Lovable Cloud)

Habilitar Lovable Cloud y crear en una sola migración:

- **profiles** (id → auth.users, full_name, avatar_url, created_at)
- **user_roles** (id, user_id, role enum: `admin` | `user`) + función `has_role(uuid, app_role)` SECURITY DEFINER
- **members** (id, full_name, email, phone, photo_url, status: activo/suspendido/vencido, plan_id, join_date, next_payment, notes)
- **plans** (id, name, price, duration_days)
- **coaches** (id, full_name, email, phone, specialty)
- **classes** (id, name/WOD, coach_id, date, time, capacity, level, status)
- **class_attendees** (id, class_id, member_id, status: inscrito/asistió/lista_espera)
- **payments** (id, member_id, amount, method, paid_at, status)
- **attendance** (id, member_id, checked_in_at)
- **prs** (id, member_id, lift_name, weight, date) — para PRs de miembros

RLS: solo `admin` puede leer/escribir todas las tablas (via `has_role`). `profiles` legible por su dueño. Sin datos demo.

**Auto-promoción primer admin:** trigger `on_auth_user_created` que crea `profiles` y, si no existe ningún registro en `user_roles` con rol `admin`, inserta al nuevo usuario como `admin`; el resto queda como `user`.

## 2. Autenticación

- Ruta pública `/auth` con email+password (signup + login) usando Supabase.
- `_authenticated/route.tsx` gestionado por la integración (redirige a `/auth`).
- Layout `_authenticated/_admin.tsx` con `beforeLoad` que consulta `has_role(uid, 'admin')` vía server fn; si no es admin muestra pantalla "Acceso restringido" con opción de cerrar sesión.
- Header con logo **Dlovebox** y menú de perfil (avatar → cerrar sesión).

## 3. Estructura de rutas

```
/auth                          → login/signup
/                              → redirige a /dashboard si autenticado, a /auth si no
/_authenticated/_admin/
  dashboard                    → resumen + acciones rápidas
  members                      → lista + búsqueda + filtros + FAB
  members/$id                  → detalle miembro (tabs: info, pagos, asistencia, PRs)
  classes                      → clases del día
  classes/$id                  → detalle clase + asistentes
  finances                     → ingresos, pendientes, últimos pagos
  attendance                   → check-in manual + historial
  more                         → menú con coaches/planes/config/reportes/notif/archivos/logout
  more/coaches
  more/plans
  more/settings
  more/reports
  more/notifications
  more/files
```

Barra inferior fija con 5 pestañas: **Dashboard · Miembros · Clases · Finanzas · Más**.

## 4. Pantallas y componentes

**Dashboard**
- 6 tarjetas de métricas en grid 2 columnas (miembros activos, clases hoy, ingresos mes, nuevos semana, ocupación %, membresías por vencer).
- Sección "Próximas clases" con barra de progreso (10/15).
- "Actividad reciente" (check-ins, pagos, nuevos usuarios).
- 4 acciones rápidas (Agregar miembro, Crear clase, Registrar pago, Registrar asistencia) como botones grandes con icono.

**Miembros**
- Buscador sticky arriba, chips de filtro (Todos/Activo/Suspendido/Vencido).
- Lista con avatar, nombre, chip de estado, plan, próximo pago.
- FAB verde lima para agregar.
- Detalle con tabs (Info, Membresía, Pagos, Asistencia, PRs, Observaciones) y acciones (Editar, Suspender, Renovar).

**Clases**
- Tarjetas por clase: WOD, coach, hora, cupos (barra progreso), nivel (chip), estado.
- Detalle: info, lista asistentes, lista de espera, botones "Marcar asistencia" / "Agregar participante", estadísticas.

**Finanzas**
- Card grande "Ingresos del mes", cards pequeñas (pendientes, renovaciones).
- Lista últimos pagos con filtro por fecha.

**Asistencia**
- Buscador de miembro + botón grande "Check-in".
- Lista "Asistieron hoy".
- Historial + stats semanales (mini bar chart con Recharts).

**Más**
- Lista con iconos hacia sub-pantallas.
- Placeholders funcionales para Coaches, Planes, Configuración, Reportes, Notificaciones, Archivos.
- Botón "Cerrar sesión" destacado en rojo.

## 5. Sistema de diseño

Actualizar `src/styles.css`:
- Dark mode por defecto (aplicar `.dark` al `<html>`).
- `--background`: casi negro (#0A0A0A), `--card`: #141414, `--border`: sutil.
- `--primary`: verde lima #C6FF3B, `--primary-foreground`: negro.
- Radius grande (1rem), sombras muy sutiles.
- Tipografía: Inter (via `<link>` en __root).
- Componentes reutilizables: `MetricCard`, `ClassCard`, `MemberRow`, `StatChip`, `ProgressBar`, `BottomNav`, `MobileHeader`, `FAB`, `QuickAction`, `ActivityItem`.

## Detalles técnicos

- Server functions con `.middleware([requireSupabaseAuth])` para queries admin; cada una revalida rol admin.
- TanStack Query con `ensureQueryData` + `useSuspenseQuery` en loaders.
- Todos los grants explícitos por tabla (SELECT/INSERT/UPDATE/DELETE a `authenticated`, `ALL` a `service_role`).
- Meta `head()` propio por ruta.
- Preview forzado a móvil.

## Fuera de alcance

- Vista para atletas/miembros (no login público de miembros).
- Datos de ejemplo (queda vacío).
- Pagos reales / integración Stripe.
- Notificaciones push reales.
