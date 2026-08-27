import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, Users, Briefcase, LineChart, Settings, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/colaboradores", label: "Colaboradores", icon: Users },
  { to: "/cargos", label: "Cargos", icon: Briefcase },
  { to: "/plano-cargos-salarios", label: "Plano de Cargos e Salários", icon: LineChart },
  { to: "/configuracoes", label: "Configurações", icon: Settings, rhOnly: true },
];

export default function AppLayout() {
  const { profile, isRh, signOut } = useAuth();

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <aside className="flex w-64 flex-none flex-col border-r border-[var(--border)] bg-[var(--surface)] px-4 py-6">
        <div className="mb-8 px-2">
          <p className="font-display text-lg font-semibold text-[var(--ink)]">RH · DISC</p>
          <p className="text-xs text-[var(--ink-muted)]">Cargos & Salários</p>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV.filter((item) => !item.rhOnly || isRh).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                  isActive ? "bg-brand-700 text-white" : "text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--ink)]"
                )
              }
            >
              <item.icon size={17} strokeWidth={2} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-6 border-t border-[var(--border)] pt-4">
          <p className="truncate px-2 text-sm font-semibold text-[var(--ink)]">{profile?.full_name || profile?.email}</p>
          <p className="px-2 text-xs text-[var(--ink-muted)]">{isRh ? "RH" : "Gestor(a)"}</p>
          <button
            onClick={() => signOut()}
            className="mt-2 flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-medium text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--ink)]"
          >
            <LogOut size={16} /> Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-8 py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
