import { Link, useRouterState } from "@tanstack/react-router";
import {
  Upload,
  LayoutDashboard,
  Dna,
  Sparkles,
  Workflow,
  Bot,
  Activity,
} from "lucide-react";

const items = [
  { to: "/", label: "Upload", icon: Upload },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/gene-explorer", label: "Gene Explorer", icon: Dna },
  { to: "/insights", label: "AI Insights", icon: Sparkles },
  { to: "/pipeline", label: "Pipeline", icon: Workflow },
  { to: "/copilot", label: "Copilot", icon: Bot },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-2 px-5 py-5 border-b border-sidebar-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-navy text-navy-foreground">
          <Activity className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-sidebar-foreground">Pathogen AI</div>
          <div className="text-[11px] text-muted-foreground">Research Workspace</div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {items.map((item) => {
          const active =
            item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t border-sidebar-border text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
          GPU cluster online
        </div>
      </div>
    </aside>
  );
}
