import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Download, Loader2, Sparkles, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtSkopje } from "@/lib/metrics";
import { managementDeckSchema, presentationHtml, type ReportFilters, type SavedManagementReport } from "@/lib/management-report";

export function ManagementReportButton({ filters, disabled }: { filters: ReportFilters; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("Reading selected report data…");
  const [report, setReport] = useState<SavedManagementReport | null>(null);
  const [slide, setSlide] = useState(0);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => { setReport(null); setError(null); setSlide(0); }, [filters.start, filters.end, filters.channel, filters.granularity]);

  const generate = async () => {
    const controller = new AbortController(); abort.current = controller;
    setBusy(true); setError(null); setReport(null); setSlide(0);
    setProgress("Reading selected report data…");
    let complete = false;
    try {
      const response = await fetch("/api/management-report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(filters), signal: controller.signal });
      if (!response.ok) {
        const body = await response.json() as { error?: string };
        throw new Error(body.error ?? `Report could not be generated (${response.status}).`);
      }
      if (!response.body) throw new Error("The report stream was unavailable.");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      const consume = (line: string) => {
        if (!line.trim()) return;
        const event = JSON.parse(line) as { type: string; message?: string; report?: SavedManagementReport };
        if (event.type === "error") throw new Error(event.message ?? "The AI report could not be completed.");
        if (event.type === "progress") setProgress(event.message ?? "Preparing management slides…");
        if (event.type === "complete" && event.report) {
          managementDeckSchema.parse(event.report.deck);
          setReport(event.report); complete = true;
        }
      };
      while (true) {
        const chunk = await reader.read();
        buffer += decoder.decode(chunk.value, { stream: !chunk.done });
        const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
        for (const line of lines) consume(line);
        if (chunk.done) break;
      }
      consume(buffer);
      if (!complete) throw new Error("Generation ended before the presentation was complete.");
    } catch (e) {
      setError(controller.signal.aborted ? "Generation stopped. No completed presentation was saved." : e instanceof Error ? e.message : "The report could not be generated.");
    } finally { setBusy(false); abort.current = null; }
  };
  const download = () => {
    if (!report) return;
    const styles = getComputedStyle(document.documentElement);
    const theme = Object.fromEntries(["background", "foreground", "primary", "muted-foreground", "border", "card"].map((k) => [k, styles.getPropertyValue(`--${k}`).trim()]));
    const url = URL.createObjectURL(new Blob([presentationHtml(report, theme)], { type: "text/html" }));
    const a = document.createElement("a"); a.href = url; a.download = `neptun-management_synthetic_${report.filters.start}_${report.filters.end}.html`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };
  const active = report?.deck.slides[slide];
  return <>
    <Button onClick={() => setOpen(true)} disabled={disabled} variant="analytics" className="h-auto min-h-9 whitespace-normal text-left"><Sparkles aria-hidden="true" />AI management report</Button>
    <Dialog open={open} onOpenChange={(v) => { if (!v) abort.current?.abort(); setOpen(v); }}>
      <DialogContent className="management-dialog max-h-[90dvh] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto rounded-lg p-4 sm:p-6">
        <DialogHeader className="management-dialog-header border-b border-border pb-4 pr-6 text-left">
          <DialogTitle className="leading-snug text-primary">{report?.deck.title ?? "AI management report"}</DialogTitle>
          <DialogDescription>DEMO DATA — SYNTHETIC · AI-generated draft</DialogDescription>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">{(report?.filters ?? filters).start} → {(report?.filters ?? filters).end} · {(report?.filters ?? filters).channel} · {(report?.filters ?? filters).granularity}</p>
        {!report && !busy && <div className="space-y-3 border-y border-border py-5">
          <h2 className="font-semibold text-primary">Manager &amp; director briefing</h2>
          <p className="text-sm text-muted-foreground">Five slides: executive summary, channel performance, shopping journey, optimization priorities and next decisions.</p>
          <p className="text-sm text-muted-foreground">Recommendations are test hypotheses based on fictional data, not proven gains. No ads or budgets will be changed.</p>
          <p className="text-xs text-muted-foreground">Generation uses Lovable AI workspace credits. Review the draft before sharing.</p>
        </div>}
        {busy && <div role="status" className="flex min-h-48 flex-col items-center justify-center gap-4 text-center"><Loader2 aria-hidden="true" className="size-7 animate-spin text-primary motion-reduce:animate-none" /><p className="text-sm text-muted-foreground">{progress}</p><Button variant="outline" onClick={() => abort.current?.abort()}><Square aria-hidden="true" />Stop</Button></div>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {active && report && <>
          <article aria-label={`Slide ${slide + 1}`} className="min-h-80 space-y-5 border-y border-border py-6">
            <p className="text-xs font-medium uppercase text-muted-foreground">NEPTUN · {slide + 1} / {report.deck.slides.length}</p>
            <h2 className="break-words text-2xl font-semibold leading-snug text-primary">{active.title}</h2>
            <p className="text-base font-medium text-foreground">{active.takeaway}</p>
            <ul className="space-y-4">{active.points.map((p, i) => <li key={i} className="border-l-2 border-chart-2 pl-4"><p className="text-sm font-medium text-foreground">{p.statement}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{p.evidence}</p></li>)}</ul>
          </article>
          <details className="text-sm"><summary className="cursor-pointer font-medium text-primary">Speaker notes</summary><p className="mt-2 whitespace-pre-wrap leading-relaxed text-muted-foreground">{active.speakerNotes}</p></details>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="icon" variant="outline" aria-label="Previous slide" title="Previous slide" disabled={slide === 0} onClick={() => setSlide((s) => s - 1)}><ArrowLeft aria-hidden="true" /></Button>
            <span className="min-w-12 text-center text-sm text-muted-foreground">{slide + 1} / 5</span>
            <Button size="icon" variant="outline" aria-label="Next slide" title="Next slide" disabled={slide === 4} onClick={() => setSlide((s) => s + 1)}><ArrowRight aria-hidden="true" /></Button>
            <Button variant="outline" className="sm:ml-auto" onClick={download}><Download aria-hidden="true" />Download presentation</Button>
            <Button variant="ghost" onClick={() => { setReport(null); setError(null); }}>New report</Button>
          </div>
          <p className="text-xs text-muted-foreground">Generated {fmtSkopje(report.generatedAt)} · Data last updated {report.dataUpdatedAt ? fmtSkopje(report.dataUpdatedAt) : "N/A"}. Review before sharing; suggestions are not proven outcomes.</p>
        </>}
        {!busy && !report && <Button variant="analytics" onClick={generate}><Sparkles aria-hidden="true" />Generate presentation</Button>}
      </DialogContent>
    </Dialog>
  </>;
}