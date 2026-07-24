import type { Metadata } from "next";
import { Archivo, Public_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import "@copilotkit/react-core/v2/styles.css";
import { Providers } from "@/components/Providers";

// Archivo for display: a grotesque with the flat, institutional cut of lab
// equipment labelling. Public Sans for body — drawn for public-sector
// documents, the right register for a public-health tool. Plex Mono for every
// number, so data reads as instrument output rather than prose.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Gut-to-Pancreas AMR — resistance and virulence co-occurrence",
  description:
    "Research prototype. Lineage-corrected resistance and virulence co-occurrence across gut-derived pathogens implicated in infected pancreatic necrosis. Not for clinical use.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${publicSans.variable} ${plexMono.variable} h-full`}
    >
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
