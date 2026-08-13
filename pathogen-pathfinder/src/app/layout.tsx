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
        <title>Pathogen AI — Research Workspace</title>
        <meta
          name="description"
          content="Upload files, connect an API, or use sample data to explore pathogen AMR clusters with a CopilotKit agent."
        />
        {/*
          No manual <link rel="icon">: a hardcoded root-absolute href ignores
          basePath and 404s wherever the app is not served from /. Next serves
          src/app/favicon.ico automatically and prefixes it correctly.
        */}
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
