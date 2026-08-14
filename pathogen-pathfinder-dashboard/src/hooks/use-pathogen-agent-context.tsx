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
import { useWorkspace } from "@/lib/workspace-store";
import { deriveChartData } from "@/lib/data-sources";
import {
  BarChart,
  BarChartProps,
} from "@/components/generative-ui/charts/bar-chart";
import {
  PieChart,
  PieChartProps,
} from "@/components/generative-ui/charts/pie-chart";
import { ToolReasoning } from "@/components/tool-rendering";

/**
 * Keeps the CopilotKit agent shared state in sync with the loaded Pathogen AI
 * workspace dataset, and registers frontend tools the agent can call.
 */
export function usePathogenAgentContext() {
  const { agent } = useAgent({ agentId: "default" });
  const { dashboardData, dataSource, connectionName, lastSyncedAt, analyzed } =
    useWorkspace();

  const derived = useMemo(
    () => (dashboardData ? deriveChartData(dashboardData) : null),
    [dashboardData],
  );

  const pathogenSnapshot = useMemo(
    () => ({
      analyzed,
      dataSource,
      connectionName,
      lastSyncedAt,
      dataset: derived,
    }),
    [analyzed, dataSource, connectionName, lastSyncedAt, derived],
  );

  const pathogenJson = useMemo(
    () => JSON.stringify(pathogenSnapshot),
    [pathogenSnapshot],
  );

  useAgentContext({
    description: "Currently loaded Pathogen AI workspace dataset",
    value: pathogenJson,
  });

  useEffect(() => {
    if (!agent?.setState) return;
    const prev = JSON.stringify(agent.state?.pathogen ?? null);
    if (prev === pathogenJson) return;
    agent.setState({
      ...(agent.state ?? {}),
      pathogen: pathogenSnapshot,
    });
  }, [agent, pathogenJson, pathogenSnapshot]);

  useFrontendTool(
    {
      name: "getPathogenDataset",
      description:
        "Return the currently loaded pathogen AMR dataset (clusters, gene classes, insights, KPIs). Call this before answering dataset questions.",
      parameters: z.object({}),
      handler: async () => {
        if (!derived) {
          return {
            loaded: false,
            message:
              "No dataset loaded yet. Ask the user to choose a data source on the Upload page.",
          };
        }
        return {
          loaded: true,
          dataSource,
          connectionName,
          lastSyncedAt,
          dataset: derived,
        };
      },
    },
    [derived, dataSource, connectionName, lastSyncedAt],
  );

  useComponent({
    name: "barChart",
    description: "Render a bar chart for pathogen cluster or gene-class data.",
    parameters: BarChartProps,
    render: BarChart,
  });

  useComponent({
    name: "pieChart",
    description: "Render a pie chart for phenotype or species breakdowns.",
    parameters: PieChartProps,
    render: PieChart,
  });

  useDefaultRenderTool({
    render: ({ name, status, parameters }) => {
      if (name === "getPathogenDataset") return <></>;
      return <ToolReasoning name={name} status={status} args={parameters} />;
    },
  });
}
