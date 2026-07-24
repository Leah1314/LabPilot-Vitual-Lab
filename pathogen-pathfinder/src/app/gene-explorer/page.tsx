"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { geneClasses as fallbackGeneClasses } from "@/lib/mock-data";
import { useWorkspace } from "@/lib/workspace-store";
import { deriveChartData } from "@/lib/data-sources";

export default GeneExplorer;

function GeneExplorer() {
  const { dashboardData } = useWorkspace();
  const geneClasses = useMemo(() => {
    if (!dashboardData) return fallbackGeneClasses;
    return deriveChartData(dashboardData).geneClasses;
  }, [dashboardData]);

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <div className="text-xs uppercase tracking-wider text-teal font-semibold">Gene Explorer</div>
      <h1 className="mt-1 text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
        Resistance gene classes
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Distribution of AMR gene classes across all analyzed genomes.
      </p>

      <div className="mt-6 card-elevated rounded-xl p-5">
        <div className="h-80">
          <ResponsiveContainer>
            {/* TODO: replace with real gene counts from sp_gene.csv */}
            <BarChart data={geneClasses} layout="vertical" margin={{ left: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={11} width={110} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="count" fill="var(--teal)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {geneClasses.map((g) => (
          <div key={g.name} className="card-elevated rounded-xl p-5">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">{g.name}</div>
            <div className="mt-2 text-2xl font-bold text-foreground">{g.count}</div>
            <div className="text-[11px] text-muted-foreground mt-1">isolates carrying gene class</div>
          </div>
        ))}
      </div>
    </div>
  );
}
