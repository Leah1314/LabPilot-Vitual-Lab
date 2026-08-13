"use client";

import "./globals.css";
import "@copilotkit/react-core/v2/styles.css";

import { CopilotKit } from "@copilotkit/react-core/v2";
import { AppProviders } from "@/components/pathogen/app-providers";
import { demonstrationCatalog } from "./declarative-generative-ui/renderers";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>LabPilot — Drug Discovery Workspace</title>
        <meta
          name="description"
          content="Explore prior evidence, simulate candidate doses, and decide what to test next in the LabPilot Virtual Lab."
        />
        <link rel="icon" href="/favicon.ico" type="image/x-icon" />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <CopilotKit
          runtimeUrl="/api/copilotkit"
          inspectorDefaultAnchor={{ horizontal: "right", vertical: "top" }}
          a2ui={{ catalog: demonstrationCatalog }}
          openGenerativeUI={{}}
          useSingleEndpoint={false}
        >
          <AppProviders>{children}</AppProviders>
        </CopilotKit>
      </body>
    </html>
  );
}
