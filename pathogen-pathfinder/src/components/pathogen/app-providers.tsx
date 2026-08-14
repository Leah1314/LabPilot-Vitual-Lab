"use client";

import { WorkspaceProvider } from "@/lib/workspace-store";
import { AppSidebar } from "@/components/pathogen/app-sidebar";
import { CopilotChatConfigurationProvider } from "@copilotkit/react-core/v2";
import { usePathogenAgentContext } from "@/hooks/use-pathogen-agent-context";

function AgentContextBridge({ children }: { children: React.ReactNode }) {
  usePathogenAgentContext();
  return <>{children}</>;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <CopilotChatConfigurationProvider agentId="default">
        <AgentContextBridge>
          <div className="flex min-h-screen w-full bg-background text-foreground">
            <AppSidebar />
            <main className="min-w-0 flex-1 animate-fade-in pb-20 md:pb-0">{children}</main>
          </div>
        </AgentContextBridge>
      </CopilotChatConfigurationProvider>
    </WorkspaceProvider>
  );
}
