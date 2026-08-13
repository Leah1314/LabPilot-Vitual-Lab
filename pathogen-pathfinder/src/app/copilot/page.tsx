"use client";

import { useMemo } from "react";
import { Bot, Database, Link2, UploadCloud } from "lucide-react";
import {
  CopilotChat,
  CopilotChatConfigurationProvider,
  useConfigureSuggestions,
} from "@copilotkit/react-core/v2";
import { useWorkspace } from "@/lib/workspace-store";
import { deriveChartData } from "@/lib/data-sources";

const quickActions = [
  {
    title: "Mechanism coverage",
    message:
      "Use Convoke to audit KPC and OXA-48 development-program coverage for the Klebsiella computational annotations. Verify entity resolution, separate external program evidence from local phenotype evidence, and identify what is supported or contested.",
  },
  {
    title: "Challenge a pattern",
    message:
      "Investigate the strongest apparent resistance pattern. Compare supporting evidence with the strongest counter-explanation and show the trace.",
  },
  {
    title: "Top insight",
    message: "Explain the top-scoring insight and its Braintrust eval score.",
  },
  {
    title: "Gene classes",
    message: "Show the top gene classes and render a bar chart of counts.",
  },
];

function CopilotSuggestions() {
  useConfigureSuggestions({
    suggestions: quickActions,
    available: "always",
  });
  return null;
}

export default function CopilotPage() {
  const { dashboardData, dataSource, connectionName, lastSyncedAt } =
    useWorkspace();
  const derived = useMemo(
    () => (dashboardData ? deriveChartData(dashboardData) : null),
    [dashboardData],
  );

  const sourceMeta =
    dataSource === "api"
      ? { icon: Link2, label: "Live API" }
      : dataSource === "upload"
        ? { icon: UploadCloud, label: "Uploaded Files" }
        : dataSource === "sample"
          ? { icon: Database, label: "Sample Dataset" }
          : null;

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto h-[calc(100vh-1rem)] flex flex-col">
      <div className="text-xs uppercase tracking-wider text-teal font-semibold">
        AI Copilot
      </div>
      <h1 className="mt-1 text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
        Chat with your dataset
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        CopilotKit coordinates grounded tools over the currently loaded
        workspace data.
      </p>

      {sourceMeta && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
          <div className="inline-flex min-w-0 items-center gap-2 rounded-full border border-border bg-card px-3 py-1">
            <sourceMeta.icon className="h-3.5 w-3.5 shrink-0 text-teal" />
            <span className="font-medium text-foreground">{sourceMeta.label}</span>
            {connectionName && (
              <span className="truncate text-muted-foreground">
                · {connectionName}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 text-muted-foreground tabular-nums">
            {lastSyncedAt && (
              <span>
                Synced {new Date(lastSyncedAt).toLocaleTimeString()}
              </span>
            )}
            {derived && (
              <span>
                {derived.clusters.length} clusters · {derived.totalGenomes}{" "}
                genomes
              </span>
            )}
          </div>
        </div>
      )}

      {!derived && (
        <div className="mt-4 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
          <Bot className="h-3.5 w-3.5 text-teal" />
          No dataset loaded yet — choose a data source on Upload, then come back
          here for grounded answers.
        </div>
      )}

      <div className="mt-4 flex-1 min-h-0 card-elevated rounded-2xl overflow-hidden [&_.copilotKitChat]:h-full">
        <CopilotChatConfigurationProvider
          agentId="default"
          labels={{
            modalHeaderTitle: "Pathogen AI Copilot",
            chatInputPlaceholder:
              "Ask about a cluster, gene, or resistance pattern…",
            welcomeMessageText:
              "Ask me about clusters, resistance patterns, gene classes, or insights. I ground answers in your loaded dataset via getPathogenDataset.",
            chatDisclaimerText: "",
          }}
        >
          <CopilotSuggestions />
          <CopilotChat
            className="h-full"
            input={{
              disclaimer: () => null,
              className: "pb-4",
            }}
          />
        </CopilotChatConfigurationProvider>
      </div>
    </div>
  );
}
