"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Sparkles, BookOpen, FlaskConical, ReceiptText, Activity } from "lucide-react";

const items = [
  { href: "/dashboard", label: "Discovery Workspace", icon: LayoutDashboard },
  { href: "/dashboard#evidence", label: "Evidence", icon: BookOpen },
  { href: "/dashboard#next-experiment", label: "Next Experiment", icon: FlaskConical },
  { href: "/dashboard#brainstorm", label: "Brainstorm Lab", icon: Sparkles },
  { href: "/dashboard#receipts", label: "Run Receipts", icon: ReceiptText },
] as const;

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-2 px-5 py-5 border-b border-sidebar-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-navy text-navy-foreground">
          <Activity className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-sidebar-foreground">LabPilot</div>
          <div className="text-[11px] text-muted-foreground">Virtual Lab</div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {items.map((item) => {
          const active = item.href === "/dashboard" ? pathname === "/dashboard" : false;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
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
          Model workspace ready
        </div>
      </div>
    </aside>
  );
}
