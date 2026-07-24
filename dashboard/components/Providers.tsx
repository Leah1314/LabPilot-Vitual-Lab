"use client";

import { CopilotKit } from "@copilotkit/react-core/v2";

/**
 * v2 provider. `showDevConsole` is on in development because debugging a
 * silent tool-call failure without it costs an hour (frontend.md §1).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      showDevConsole={process.env.NODE_ENV === "development"}
    >
      {children}
    </CopilotKit>
  );
}
