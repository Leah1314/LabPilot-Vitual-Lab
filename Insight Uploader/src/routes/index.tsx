import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState, type DragEvent } from "react";
import { UploadCloud, FileCheck2, X, Sparkles, Shield, Cpu } from "lucide-react";
import {
  REQUIRED_FILES,
  MIN_REQUIRED,
  canAnalyze,
  readyCount,
  useWorkspace,
  type UploadedFile,
} from "@/lib/workspace-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Upload dataset — Pathogen AI" },
      {
        name: "description",
        content:
          "Upload your pathogen dataset to run GPU-powered protein embeddings and grounded AI insight generation.",
      },
      { property: "og:title", content: "Upload dataset — Pathogen AI" },
      {
        property: "og:description",
        content:
          "Drop pathogen CSVs and JSON to start an antimicrobial resistance and virulence analysis.",
      },
    ],
  }),
  component: UploadPage,
});

function UploadPage() {
  const navigate = useNavigate();
  const { files, addFiles, removeFile } = useWorkspace();
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const ready = readyCount(files);
  const enabled = canAnalyze(files);

  // TODO: replace with real upload to backend storage.
  const handleFiles = (list: FileList | File[]) => {
    setUploading(true);
    const incoming: UploadedFile[] = Array.from(list).map((f) => ({
      name: f.name,
      size: f.size,
      valid: (REQUIRED_FILES as string[]).includes(f.name),
    }));
    setTimeout(() => {
      addFiles(incoming);
      setUploading(false);
    }, 700);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  const analyze = () => {
    if (!enabled) return;
    navigate({ to: "/analyzing" });
  };

  return (
    <div className="hero-gradient min-h-screen">
      <div className="mx-auto max-w-5xl px-6 py-16 lg:py-24">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 backdrop-blur px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-teal" />
            Upload-first AI Research Workspace
          </div>
          <h1 className="mt-6 text-4xl lg:text-6xl font-bold tracking-tight text-foreground">
            Upload your pathogen dataset
          </h1>
          <p className="mt-5 text-base lg:text-lg text-muted-foreground leading-relaxed">
            Analyze antimicrobial resistance and virulence patterns using GPU-powered protein
            embeddings, AI insight generation and grounded validation.
          </p>
        </div>

        {/* Upload card */}
        <div className="mt-12">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`card-elevated rounded-2xl border-2 border-dashed transition-all cursor-pointer p-10 lg:p-14 text-center ${
              dragOver
                ? "border-teal bg-accent/60 scale-[1.01]"
                : "border-border hover:border-teal/60 hover:bg-accent/30"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              accept=".csv,.json"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
            <div
              className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-teal/10 text-teal ${
                uploading ? "animate-pulse" : ""
              }`}
            >
              <UploadCloud className="h-8 w-8" />
            </div>
            <div className="mt-5 text-lg font-semibold text-foreground">
              {uploading ? "Uploading…" : "Drag & drop files here"}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              or click to browse — CSV and JSON supported
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground">
              {REQUIRED_FILES.map((n) => (
                <span
                  key={n}
                  className="rounded-full border border-border bg-background/70 px-2 py-1 font-mono"
                >
                  {n}
                </span>
              ))}
            </div>
          </div>

          {/* Uploaded files */}
          {files.length > 0 && (
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {files.map((f) => (
                <div
                  key={f.name}
                  className="card-elevated rounded-lg px-4 py-3 flex items-center justify-between animate-fade-in"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileCheck2
                      className={`h-4 w-4 shrink-0 ${f.valid ? "text-success" : "text-muted-foreground"}`}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{f.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {(f.size / 1024).toFixed(1)} KB {f.valid ? "· validated" : "· unrecognized"}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(f.name);
                    }}
                    className="text-muted-foreground hover:text-foreground p-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Analyze row */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm">
              <span
                className={`font-semibold ${enabled ? "text-success" : "text-muted-foreground"}`}
              >
                {ready}/{MIN_REQUIRED.length} Files Ready
              </span>
              <span className="text-muted-foreground ml-2">
                {enabled
                  ? "All required files uploaded"
                  : "Add the required files to enable analysis"}
              </span>
            </div>
            <button
              disabled={!enabled}
              onClick={analyze}
              className={`inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition-all ${
                enabled
                  ? "bg-navy text-navy-foreground hover:bg-navy/90 shadow-lg shadow-navy/20"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              }`}
            >
              <Sparkles className="h-4 w-4" />
              Analyze Dataset
            </button>
          </div>
        </div>

        {/* Feature strip */}
        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Cpu, title: "H100 embeddings", body: "ESM2 protein embeddings on Daytona." },
            { icon: Sparkles, title: "AI insights", body: "Fireworks AI generation per cluster." },
            { icon: Shield, title: "Grounded validation", body: "Braintrust verifies every claim." },
          ].map((f) => (
            <div key={f.title} className="card-elevated rounded-xl p-5">
              <f.icon className="h-5 w-5 text-teal" />
              <div className="mt-3 text-sm font-semibold text-foreground">{f.title}</div>
              <div className="text-xs text-muted-foreground mt-1">{f.body}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
