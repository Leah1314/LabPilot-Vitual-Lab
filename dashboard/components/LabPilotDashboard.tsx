"use client";

import { FormEvent, useMemo, useState } from "react";
import { measuredPoints, predictViability, recommendations, type Prediction } from "@/lib/dose-response";

type PlanStatus = "idle" | "recommended" | "planned" | "rejected";

const questions = [
  "What does this experiment show?",
  "Where is the highest uncertainty?",
  "What should I test next?",
  "Simulate 35 nM.",
];

function answerQuestion(question: string) {
  if (question.includes("uncertainty")) return "The 25–50 nM interval has the sharpest observed change and no measurement between its endpoints. The model therefore treats this region as the most useful place to reduce uncertainty.";
  if (question.includes("next")) return "Test 35 nM first. It sits inside the steep 25–50 nM transition, where one additional measurement should improve the local dose–response estimate. 15 nM and 70 nM are useful secondary checks.";
  if (question.includes("Simulate")) return "The statistical layer predicts 52% viability at 35 nM, with an estimated 44–60% range. This is a virtual result derived from log-dose interpolation—not a measured observation.";
  return "Viability decreases consistently as dose increases: from 97% at 1 nM to 20% at 100 nM. The largest measured drop occurs across 25–50 nM, suggesting the response transition is concentrated in that interval.";
}

function DoseChart({ prediction }: { prediction: Prediction | null }) {
  const width = 760;
  const height = 330;
  const pad = { left: 52, right: 22, top: 24, bottom: 42 };
  const x = (dose: number) => pad.left + (Math.log10(dose) / 2) * (width - pad.left - pad.right);
  const y = (value: number) => pad.top + ((100 - value) / 100) * (height - pad.top - pad.bottom);
  const path = measuredPoints.map((point, index) => `${index ? "L" : "M"}${x(point.dose)},${y(point.viability)}`).join(" ");

  return (
    <div className="chart-wrap" aria-label="Dose response chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="chart-title chart-desc">
        <title id="chart-title">Dose versus cell viability</title>
        <desc id="chart-desc">Six measured observations and an optional model prediction.</desc>
        {[0, 25, 50, 75, 100].map((tick) => <g key={tick}><line className="grid" x1={pad.left} x2={width-pad.right} y1={y(tick)} y2={y(tick)} /><text className="axis-text" x={pad.left-12} y={y(tick)+4} textAnchor="end">{tick}</text></g>)}
        {[1, 5, 10, 25, 50, 100].map((tick) => <text className="axis-text" key={tick} x={x(tick)} y={height-15} textAnchor="middle">{tick}</text>)}
        <path className="trend-line" d={path} />
        {measuredPoints.map((point) => <circle className="measured-dot" key={point.dose} cx={x(point.dose)} cy={y(point.viability)} r="6" />)}
        {prediction && <g><line className="range-line" x1={x(prediction.dose)} x2={x(prediction.dose)} y1={y(prediction.high)} y2={y(prediction.low)} /><circle className="predicted-dot" cx={x(prediction.dose)} cy={y(prediction.viability)} r="8" /><text className="prediction-label" x={x(prediction.dose)+12} y={y(prediction.viability)-12}>{prediction.viability}% predicted</text></g>}
        <text className="axis-label" x={16} y={height/2} transform={`rotate(-90 16 ${height/2})`} textAnchor="middle">Cell viability (%)</text>
        <text className="axis-label" x={width/2} y={height-1} textAnchor="middle">Dose (nM, log scale)</text>
      </svg>
      <div className="legend"><span><i className="legend-measured" />Measured</span><span><i className="legend-predicted" />Predicted / virtual</span></div>
    </div>
  );
}

export function LabPilotDashboard() {
  const [question, setQuestion] = useState(questions[0]);
  const [answer, setAnswer] = useState(answerQuestion(questions[0]));
  const [asking, setAsking] = useState(false);
  const [dose, setDose] = useState("35");
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [planStatus, setPlanStatus] = useState<PlanStatus>("idle");
  const [selectedDose, setSelectedDose] = useState(35);
  const [timeline, setTimeline] = useState<{ label: string; at: string }[]>([]);
  const selectedPrediction = useMemo(() => predictViability(selectedDose), [selectedDose]);

  const ask = async (next: string) => {
    setQuestion(next);
    setAsking(true);
    if (next.includes("Simulate")) { setDose("35"); setPrediction(predictViability(35)); }
    try {
      const response = await fetch("/api/labpilot/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: next }) });
      if (!response.ok) throw new Error("AI unavailable");
      const payload = (await response.json()) as { answer: string };
      setAnswer(payload.answer);
    } catch {
      // The demo remains useful without a key or network; this fallback is
      // deterministic and uses the same visible evidence/model outputs.
      setAnswer(answerQuestion(next));
    } finally { setAsking(false); }
  };
  const simulate = async (event: FormEvent) => {
    event.preventDefault(); const value = Number(dose);
    if (!Number.isFinite(value) || value < 1 || value > 100) return;
    try {
      const response = await fetch("/api/simulate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ experiment_id: "EXP-001", dose: value }) });
      if (!response.ok) throw new Error("Model unavailable");
      const result = (await response.json()) as { dose: number; predicted_response: number; estimated_range: [number, number]; uncertainty_proxy: number };
      setPrediction({ dose: result.dose, viability: result.predicted_response, low: result.estimated_range[0], high: result.estimated_range[1], uncertainty: result.uncertainty_proxy });
    } catch { setPrediction(predictViability(value)); }
    setPlanStatus("idle"); setTimeline((items) => [...items, { label: `Simulated ${value} nM`, at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
  };
  const approve = async (nextPrediction: Prediction) => {
    try { await fetch("/api/plan-experiment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ experiment_id: "EXP-001", dose: nextPrediction.dose, approved: true }) }); } catch { /* session state remains the failure-proof fallback */ }
    setPrediction(nextPrediction); setPlanStatus("planned"); setTimeline((items) => [...items, { label: `Human approved ${nextPrediction.dose} nM`, at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }, { label: "Planned experiment created", at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
  };

  return (
    <main className="lab-shell">
      <header className="topbar"><div><div className="brand-mark">LP</div><div><p className="eyebrow">LabPilot Virtual Lab</p><h1>Explore before you experiment.</h1></div></div><span className="prototype-chip">Decision support · Research prototype</span></header>
      <section className="experiment-head"><div><p className="eyebrow">Experiment LP-DR-042 · Dose response</p><h2>Palbociclib response in MCF-7 cells</h2><p>Six measured observations define the current evidence boundary.</p></div><button className="primary" onClick={() => setPlanStatus("recommended")}>✦ Suggest Next Experiment</button></section>
      <div className="meta-strip"><span><b>Compound</b> Palbociclib</span><span><b>Cell line</b> MCF-7</span><span><b>Source</b> Internal assay DR-042</span><span><b>Status</b> <em className="measured-status">Measured</em></span></div>

      <div className="dashboard-grid">
        <section className="card chart-card"><div className="card-title"><div><p className="eyebrow">Primary endpoint</p><h3>Dose → Cell viability</h3></div><span>n = 6 measured</span></div><DoseChart prediction={prediction} /></section>
        <aside className="card ask-card"><p className="eyebrow">Grounded in this experiment</p><h3>Ask LabPilot</h3><div className="question-list">{questions.map((item) => <button disabled={asking} className={question === item ? "active" : ""} key={item} onClick={() => ask(item)}>{item}</button>)}</div><div className="answer"><span>LP</span><p>{asking ? "Reviewing experiment evidence…" : answer}</p></div><p className="fineprint">OpenAI explains the six visible observations and computed model output. If unavailable, LabPilot uses a grounded local fallback. Numeric predictions are never generated by AI.</p></aside>
      </div>

      {planStatus === "recommended" && <section className="recommendation card"><div className="recommendation-lead"><p className="eyebrow">Recommended next experiment</p><h3><strong>{selectedDose}</strong> nM</h3><p>Predicted viability {selectedPrediction.viability}% · estimated range {selectedPrediction.low}–{selectedPrediction.high}%</p></div><div className="recommendation-reason"><h4>Why this point?</h4><p>The largest response change and remaining uncertainty occur between 25 and 50 nM. Another measurement here would improve the local dose-response estimate.</p><div className="evidence"><span>6 measured points</span><span>Monotonic log-dose interpolation v0.2</span><span>Confidence: Medium</span></div></div><div className="candidate-actions"><label>Candidate dose<input type="number" min="1" max="100" value={selectedDose} onChange={(event) => setSelectedDose(Number(event.target.value))} /></label><div>{recommendations.filter((item) => item.dose !== selectedDose).map((item) => <button className="candidate" key={item.dose} onClick={() => setSelectedDose(item.dose)}>{item.dose} nM</button>)}</div><button className="approve" onClick={() => approve(selectedPrediction)}>Approve & simulate</button><button className="reject" onClick={() => setPlanStatus("rejected")}>Reject</button></div></section>}

      <section className="simulation-grid"><div className="card simulator"><p className="eyebrow">Model-based preview</p><h3>Virtual Experiment</h3><form onSubmit={simulate}><label>Dose<div className="dose-input"><input aria-label="Dose in nanomolar" type="number" min="1" max="100" step="1" value={dose} onChange={(event) => setDose(event.target.value)} /><span>nM</span></div></label><button className="secondary" type="submit">Simulate Experiment</button></form><p className="fineprint">Supported range: 1–100 nM. Predictions are interpolation within measured bounds.</p></div><div className="card result-card">{prediction ? <><div className="predicted-banner">Predicted / Virtual · Not measured</div><p className="eyebrow">Virtual result</p><div className="result-number">{prediction.viability}<span>%</span></div><p>Estimated viability at {prediction.dose} nM</p><div className="range"><span>Estimated range</span><b>{prediction.low}–{prediction.high}%</b></div><div className="result-meta"><span>Evidence: 6 datapoints</span><span>Model: log-dose interpolation</span></div>{planStatus !== "planned" && <button className="approve full" onClick={() => approve(prediction)}>Approve as Next Experiment</button>}</> : <div className="empty-result"><span>◇</span><h4>No virtual result yet</h4><p>Enter a candidate dose to preview the model-based response.</p></div>}</div><div className="card planned-card"><p className="eyebrow">Human-in-the-loop decision</p><h3>Experiment plan</h3>{planStatus === "planned" && prediction ? <div className="plan"><span className="planned-badge">Planned</span><h4>{prediction.dose} nM dose-response validation</h4><dl><div><dt>Dose</dt><dd>{prediction.dose} nM</dd></div><div><dt>Source</dt><dd>LabPilot recommendation</dd></div><div><dt>Human approved</dt><dd>Yes</dd></div></dl><button className="secondary" onClick={() => setPlanStatus("idle")}>Modify plan</button></div> : <div className="empty-result compact"><span>✓</span><p>No experiment is planned until a scientist approves it.</p></div>}</div></section>
      <section className="provenance-grid"><details className="card evidence-drawer"><summary><span><span className="eyebrow">Provenance</span><b>Evidence & model details</b></span><span>6 records · Expand</span></summary><div><p>Six internal measured observations from experiment EXP-001. No public-reference records are claimed in this demo.</p><ul>{measuredPoints.map((point, index) => <li key={point.dose}><span>MCF7-{index + 1}</span><b>{point.dose} nM</b><span>{point.viability}% viability</span><em>Measured · Internal</em></li>)}</ul><p className="fineprint">Model: monotonic log-dose interpolation · version labpilot-model-0.2 · uncertainty is a distance/gap proxy, not a statistical confidence interval.</p></div></details><div className="card audit-card"><p className="eyebrow">Audit trail</p><h3>Decision timeline</h3><ol><li><span>Evidence loaded</span><time>EXP-001</time></li><li><span>Suggestion available</span><time>Model v0.2</time></li>{timeline.map((item, index) => <li key={`${item.label}-${index}`}><span>{item.label}</span><time>{item.at}</time></li>)}</ol></div></section>
      <footer>LabPilot provides research decision support. Virtual predictions are not experimental measurements and require scientist review.</footer>
    </main>
  );
}
