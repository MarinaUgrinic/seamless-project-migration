import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";

export const Route = createFileRoute("/pitch")({
  validateSearch: (s: Record<string, unknown>) => ({ slide: Math.min(5, Math.max(1, Number(s["slide"]) || 1)) }),
  head: () => ({
    meta: [
      { title: "Neptun Marketing Report — Pitch" },
      { name: "description", content: "Five-slide pitch: problem, solution, uniqueness, team and where the product fits in marketing agencies." },
      { property: "og:title", content: "Neptun Marketing Report — Pitch" },
      { property: "og:description", content: "Problem, solution, uniqueness, team and agency fit for the Neptun reporting demo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pitch,
});

function Frame({ n, kicker, title, children, dark }: { n: number; kicker: string; title: string; children: ReactNode; dark?: boolean }) {
  return (
    <div className={`flex h-full w-full flex-col px-[120px] py-[90px] ${dark ? "bg-primary text-primary-foreground" : "bg-background text-foreground"}`}>
      <div className="flex items-center justify-between text-[22px] tracking-[0.15em] uppercase opacity-70">
        <span className="font-semibold">Neptun · Marketing Report</span>
        <span>{n} / 5</span>
      </div>
      <p className={`mt-[70px] text-[26px] font-semibold uppercase tracking-[0.12em] ${dark ? "opacity-80" : "text-chart-1"}`}>{kicker}</p>
      <h2 className="mt-4 max-w-[1500px] text-[84px] font-bold leading-[1.05] tracking-tight">{title}</h2>
      <div className="mt-[60px] flex-1">{children}</div>
    </div>
  );
}

function Card({ t, d }: { t: string; d: string }) {
  return (
    <div className="rounded-2xl border-l-[10px] border-chart-2 bg-card p-10 text-card-foreground shadow-sm">
      <p className="text-[36px] font-bold leading-tight">{t}</p>
      <p className="mt-4 text-[28px] leading-snug text-muted-foreground">{d}</p>
    </div>
  );
}

const slides: ReactNode[] = [
  <Frame key={1} n={1} kicker="The problem" title="Agency reporting is still copy-paste work" dark>
    <ul className="max-w-[1400px] space-y-8 text-[40px] leading-snug">
      <li>• Each channel exports a different file: Meta, Google Ads, YouTube, Spotify, GA4, ad networks, TV.</li>
      <li>• Different headers, date ranges, click definitions and reach rules.</li>
      <li>• Manual merging into a master template is slow and easy to get wrong — e.g. summing reach or mixing click types.</li>
    </ul>
  </Frame>,
  <Frame key={2} n={2} kicker="The solution" title="One automated report from every source">
    <div className="grid grid-cols-3 gap-10">
      <Card t="1 · Collect" d="n8n workflow pulls the source exports and sends them to one guarded import." />
      <Card t="2 · Map" d="Readers for CSV, XLS and XLSX find headers by name and map 9 feed layouts." />
      <Card t="3 · Report" d="Live dashboard and master report by campaign and period, exportable to CSV." />
    </div>
  </Frame>,
  <Frame key={3} n={3} kicker="What's unique" title="Correct numbers, not just pretty charts">
    <div className="grid grid-cols-2 gap-10">
      <Card t="Honest math" d="Rates from summed totals; reach never summed; missing data shows N/A, not zero." />
      <Card t="Source meaning kept" d="Link clicks vs all clicks, GA4 revenue vs attributed revenue stay separate." />
      <Card t="No fake periods" d="Period totals are never split into invented daily rows or prorated." />
      <Card t="Safe by design" d="Strict import validation and private-data rules; the demo runs on generated data only." />
    </div>
  </Frame>,
  <Frame key={4} n={4} kicker="The team" title="Who built it">
    <div className="grid grid-cols-3 gap-10">
      {["Kiril Lazarev", "Marina Ugrinic", "Jovana Tatic"].map((name) => (
        <div key={name} className="flex flex-col items-center rounded-2xl border bg-card p-12 text-card-foreground">
          <div className="flex h-[200px] w-[200px] items-center justify-center rounded-full bg-primary text-[72px] font-bold text-primary-foreground">
            {name.split(" ").map((p) => p[0]).join("")}
          </div>
          <p className="mt-8 text-[40px] font-bold">{name}</p>
        </div>
      ))}
    </div>
  </Frame>,
  <Frame key={5} n={5} kicker="Phase & market fit" title="Working MVP, ready for an agency pilot" dark>
    <div className="grid grid-cols-2 gap-16 text-[34px] leading-snug">
      <div>
        <p className="text-[40px] font-bold">Where we are</p>
        <ul className="mt-6 space-y-5">
          <li>✓ Dashboard, filters, KPIs</li>
          <li>✓ 9 source readers + master report</li>
          <li>✓ n8n import workflows</li>
          <li>→ Next: real account connections in a private pilot</li>
        </ul>
      </div>
      <div>
        <p className="text-[40px] font-bold">Where it fits in an agency</p>
        <ul className="mt-6 space-y-5">
          <li>• Weekly / monthly client reports</li>
          <li>• Account managers: one view per campaign</li>
          <li>• Media planners: cross-channel comparison</li>
          <li>• White-label report for each client</li>
        </ul>
      </div>
    </div>
  </Frame>,
];

function Pitch() {
  const { slide } = Route.useSearch();
  const navigate = Route.useNavigate();
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const go = (d: number) => navigate({ search: { slide: Math.min(5, Math.max(1, slide + d)) }, replace: true });

  useEffect(() => {
    const fit = () => { const el = box.current; if (el) setScale(Math.min(el.clientWidth / 1920, el.clientHeight / 1080)); };
    fit(); window.addEventListener("resize", fit); return () => window.removeEventListener("resize", fit);
  }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (["ArrowRight", " ", "PageDown"].includes(e.key)) go(1);
      if (["ArrowLeft", "PageUp"].includes(e.key)) go(-1);
      if (e.key === "f") void document.documentElement.requestFullscreen?.();
    };
    window.addEventListener("keydown", k); document.title = `${slide}/5 — Neptun pitch`;
    return () => window.removeEventListener("keydown", k);
  });
  let x0 = 0;
  return (
    <div className="flex h-screen flex-col bg-foreground">
      <div ref={box} className="relative flex-1 overflow-hidden"
        onTouchStart={(e) => { x0 = e.touches[0]?.clientX ?? 0; }}
        onTouchEnd={(e) => { const dx = (e.changedTouches[0]?.clientX ?? 0) - x0; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); }}>
        <div className="absolute left-1/2 top-1/2 h-[1080px] w-[1920px] -ml-[960px] -mt-[540px]" style={{ transform: `scale(${scale})` }}>
          {slides[slide - 1]}
        </div>
      </div>
      <div className="flex items-center justify-center gap-3 p-3 text-sm text-background">
        <button className="rounded border border-background/40 px-3 py-1" onClick={() => go(-1)}>← Prev</button>
        <span>{slide} / 5</span>
        <button className="rounded border border-background/40 px-3 py-1" onClick={() => go(1)}>Next →</button>
        <button className="rounded border border-background/40 px-3 py-1" onClick={() => void document.documentElement.requestFullscreen?.()}>Present</button>
        <Link to="/" className="underline opacity-80">Dashboard</Link>
      </div>
    </div>
  );
}
