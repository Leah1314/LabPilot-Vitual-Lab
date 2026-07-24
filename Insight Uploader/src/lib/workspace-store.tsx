// Simple in-memory workspace store shared across routes.
// TODO: replace with real backend state (uploaded files stored in Lovable Cloud)
import { createContext, useContext, useState, type ReactNode } from "react";

export type RequiredFile =
  | "genome_amr.csv"
  | "sp_gene.csv"
  | "metadata.csv"
  | "sequences.csv"
  | "cluster_summary.json"
  | "observations.json";

export const REQUIRED_FILES: RequiredFile[] = [
  "genome_amr.csv",
  "sp_gene.csv",
  "metadata.csv",
  "sequences.csv",
  "cluster_summary.json",
  "observations.json",
];

// Minimum set required to enable "Analyze".
export const MIN_REQUIRED: RequiredFile[] = [
  "genome_amr.csv",
  "metadata.csv",
  "sequences.csv",
  "observations.json",
];

export type UploadedFile = {
  name: string;
  size: number;
  valid: boolean;
};

type WorkspaceState = {
  files: UploadedFile[];
  analyzed: boolean;
  addFiles: (files: UploadedFile[]) => void;
  removeFile: (name: string) => void;
  reset: () => void;
  setAnalyzed: (v: boolean) => void;
};

const Ctx = createContext<WorkspaceState | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [analyzed, setAnalyzed] = useState(false);

  return (
    <Ctx.Provider
      value={{
        files,
        analyzed,
        addFiles: (incoming) =>
          setFiles((prev) => {
            const map = new Map(prev.map((f) => [f.name, f]));
            for (const f of incoming) map.set(f.name, f);
            return Array.from(map.values());
          }),
        removeFile: (name) => setFiles((prev) => prev.filter((f) => f.name !== name)),
        reset: () => {
          setFiles([]);
          setAnalyzed(false);
        },
        setAnalyzed,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}

export function readyCount(files: UploadedFile[]) {
  const names = new Set(files.map((f) => f.name));
  return MIN_REQUIRED.filter((n) => names.has(n)).length;
}

export function canAnalyze(files: UploadedFile[]) {
  return readyCount(files) === MIN_REQUIRED.length;
}
