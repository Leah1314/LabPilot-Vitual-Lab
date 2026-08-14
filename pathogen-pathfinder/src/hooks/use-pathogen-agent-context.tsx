"use client";

import { useEffect, useMemo } from "react";
import { z } from "zod";
import {
  useAgent,
  useAgentContext,
  useComponent,
  useDefaultRenderTool,
  useFrontendTool,
} from "@copilotkit/react-core/v2";
import {
  candidate,
  measured,
  program,
  publicEvidence,
  rankedExperiments,
  receipt,
  simulation,
  sources,
} from "@/lib/drug-trial-fixtures";
import {
  BarChart,
  BarChartProps,
} from "@/components/generative-ui/charts/bar-chart";
import {
  PieChart,
  PieChartProps,
} from "@/components/generative-ui/charts/pie-chart";
import { ToolReasoning } from "@/components/tool-rendering";
import {
  RlmReceipt,
  type RlmInvestigationReceipt,
} from "@/components/pathogen/rlm-receipt";

export function usePathogenAgentContext() {
  const { agent } = useAgent({ agentId: "default" });

  const workspaceSnapshot = useMemo(
    () => ({
      loaded: true,
      program,
      evidenceSummary: {
        connectedSources: sources.length,
        measuredObservations: measured.length,
        publicEvidence: publicEvidence.length,
        predictedObservations: simulation.predictions.length,
      },
      recommendation: candidate,
      rankedExperiments,
      runReceipt: receipt,
      publicEvidence,
      measured,
      predictions: simulation.predictions,
      sources,
    }),
    [],
  );

  const workspaceJson = useMemo(
    () => JSON.stringify(workspaceSnapshot),
    [workspaceSnapshot],
  );

  useAgentContext({
    description: "Current Drug Discovery Workspace state for the RMC-6236 demo",
    value: workspaceJson,
  });

  useEffect(() => {
    if (!agent?.setState) return;
    const previous = JSON.stringify(agent.state?.drugDiscoveryWorkspace ?? null);
    if (previous === workspaceJson) return;
    agent.setState({
      ...(agent.state ?? {}),
      drugDiscoveryWorkspace: workspaceSnapshot,
    });
  }, [agent, workspaceJson, workspaceSnapshot]);

  useFrontendTool(
    {
      name: "getDrugDiscoveryWorkspace",
      description:
        "Return the active Drug Discovery Workspace state, including the RMC-6236 program context, measured observations, public evidence, deterministic predictions, ranked experiments, and the current recommendation.",
      parameters: z.object({}),
      handler: async () => workspaceSnapshot,
    },
    [workspaceSnapshot],
  );

  useFrontendTool(
    {
      name: "investigateDrugDiscoveryWorkspace",
      description:
        "Run a bounded support-versus-skeptic investigation over the active Drug Discovery Workspace. Use for competing explanations, robustness checks, recommendation challenges, and next-experiment decisions.",
      parameters: z.object({ objective: z.string().min(8) }),
      handler: async ({ objective }) => {
        const response = await fetch("/api/investigate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            objective,
            workspace: {
              generatedAt: new Date().toISOString(),
              program,
              recommendation: candidate,
              receipt,
              evidence: [
                ...measured.map((item) => ({
                  id: item.id,
                  kind: "measured",
                  title: `${item.concentrationNm} nM cellular viability`,
                  summary: `${item.viability}% viability measured in the AsPC-1 cellular model at ${item.concentrationNm} nM.`,
                })),
                ...publicEvidence.map((item) => ({
                  id: item.id,
                  kind: "public",
                  title: `${item.assay} in ${item.model}`,
                  summary: `${item.compound} showed ${item.assay} of ${item.value} ${item.unit} in ${item.model} for ${item.target}.`,
                })),
                ...simulation.predictions.map((item) => ({
                  id: item.id,
                  kind: "predicted",
                  title: `${item.concentrationNm} nM predicted viability`,
                  summary: `${item.viability}% viability predicted at ${item.concentrationNm} nM by ${item.modelVersion}.`,
                })),
              ],
              alternatives: rankedExperiments.slice(1, 5).map((item) => ({
                id: `alt-${item.rank}`,
                title: item.experiment,
                summary: `${item.informationGain} information gain, ${item.evidenceGap} evidence gap, ${item.complexity} complexity.`,
              })),
            },
          }),
        });
        if (!response.ok) {
          const error = (await response.json().catch(() => null)) as
            | { error?: string; message?: string }
            | null;
          throw new Error(
            error?.message ?? error?.error ?? "Investigation failed.",
          );
        }
        return (await response.json()) as RlmInvestigationReceipt;
      },
      render: ({ status, result }) => {
        if (status === "inProgress" || status === "executing") {
          return (
            <div className="card-elevated rounded-xl px-4 py-3 text-xs text-muted-foreground">
              Investigating support and counter-evidence…
            </div>
          );
        }
        if (!result) return <></>;
        try {
          const receipt =
            typeof result === "string"
              ? (JSON.parse(result) as RlmInvestigationReceipt)
              : (result as RlmInvestigationReceipt);
          return <RlmReceipt receipt={receipt} />;
        } catch {
          return <></>;
        }
      },
    },
    [],
  );

  useComponent({
    name: "barChart",
    description: "Render a bar chart for drug-discovery evidence comparisons.",
    parameters: BarChartProps,
    render: BarChart,
  });

  useComponent({
    name: "pieChart",
    description: "Render a pie chart for evidence composition or source mix.",
    parameters: PieChartProps,
    render: PieChart,
  });

  useDefaultRenderTool({
    render: ({ name, status, parameters }) => {
      if (name === "getDrugDiscoveryWorkspace") return <></>;
      return <ToolReasoning name={name} status={status} args={parameters} />;
    },
  });
}
