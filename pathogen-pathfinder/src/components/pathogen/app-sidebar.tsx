"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  { href: "/", label: "Upload", icon: Upload },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/gene-explorer", label: "Gene Explorer", icon: Dna },
  { href: "/insights", label: "AI Insights", icon: Sparkles },
  { href: "/pipeline", label: "Pipeline", icon: Workflow },
  { href: "/copilot", label: "Copilot", icon: Bot },
] as const;

export function AppSidebar() {
  const pathname = usePathname();

  const links = items.map((item) => {
    const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
    const Icon = item.icon;
    return { ...item, active, Icon };
  });

  return (
    <>
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
        {links.map(({ href, label, active, Icon }) => {
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
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
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-6 rounded-2xl border border-border bg-card/95 p-1 shadow-lg backdrop-blur md:hidden"
    >
      {links.map(({ href, label, active, Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={active ? "page" : undefined}
          className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[9px] font-medium ${
            active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground"
          }`}
        >
          <Icon className="h-4 w-4" />
          <span className="w-full truncate text-center">{label}</span>
        </Link>
      ))}
    </nav>
    </>
  );
}
