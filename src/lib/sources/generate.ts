// @ts-nocheck -- plain JS on purpose: this function's source text is embedded in the n8n Code node; typed wrapper lives in bundle.ts.
/**
 * Canonical, wholly synthetic source bundle ("sources.v2").
 * Every name, date and value here is invented. The function is self-contained (no imports,
 * no outer references) because its source text is embedded in the n8n workflow Code node.
 * Each workbook is { format, sheets: [{ name, rows }] }, rows being 1-based sheet rows as arrays
 * (index 0 = column A). Blank cells are null.
 */
export function generateSourceBundle() {
  const day = (i) => new Date(Date.UTC(2026, 9, 15 + i)).toISOString().slice(0, 10);
  const dmy = (iso) => iso.slice(8, 10) + "." + iso.slice(5, 7) + "." + iso.slice(0, 4);
  const r2 = (n) => Math.round(n * 100) / 100;
  const r4 = (n) => Math.round(n * 10000) / 10000;

  // META — headers on row 1, one daily row per date, Meta-style summary row last.
  const metaHeader = ["Reporting starts", "Reporting ends", "Campaign name", "Campaign delivery", "Attribution setting", "Results", "Result indicator", "Reach", "Frequency", "Cost per results", "Ad set budget", "Ad set budget type", "Amount spent (EUR)", "Ends", "Impressions", "CPM (cost per 1,000 impressions) (EUR)", "Link clicks", "shop_clicks", "CPC (cost per link click) (EUR)", "CTR (link click-through rate)", "Clicks (all)", "CTR (all)", "CPC (all) (EUR)", "Landing page views", "Cost per landing page view (EUR)", "Results (initial)", "Results (initial) indicator"];
  const metaRows = [metaHeader];
  const mt = { spend: 0, impr: 0, link: 0, all: 0, shop: 0, lpv: 0 };
  for (let i = 0; i < 30; i++) {
    const spend = 100 + i, impr = 10000 + 100 * i, link = 200 + 2 * i, all = link + 40 + i;
    const reach = 7000 + 50 * i, lpv = 150 + i, shop = 10 + (i % 4);
    mt.spend += spend; mt.impr += impr; mt.link += link; mt.all += all; mt.shop += shop; mt.lpv += lpv;
    metaRows.push([day(i), day(i), "Synthetic Demo Campaign A", "active", "7-day click or 1-day view", lpv, "actions:landing_page_view", reach, r2(impr / reach), r2(spend / lpv), 150, "Daily", spend, "Ongoing", impr, r2((spend / impr) * 1000), link, shop, r2(spend / link), r2((link / impr) * 100), all, r2((all / impr) * 100), r2(spend / all), lpv, r2(spend / lpv), lpv, "actions:landing_page_view"]);
  }
  metaRows.push([day(0), day(29), null, null, null, mt.lpv, null, 61000, null, null, null, null, mt.spend, null, mt.impr, null, mt.link, mt.shop, null, null, mt.all, null, null, mt.lpv, null, mt.lpv, null]);

  // GOOGLE ADS — two metadata rows, header row 3, campaign period totals, then Total rows.
  const g = [
    ["Enabled", "Synthetic Search Demo", 180, "Synthetic search budget", "Daily", "EUR", "Eligible", "Generated eligible campaign", "84.0%", "Search", 250.5, 5400, r2(5000 / 250.5), "2.80%", r2(5000 / 5400), "61.20%", 180000, "3.00%", 5000, "1.12"],
    ["Enabled", "Synthetic Brand Demo", 40, "Synthetic brand budget", "Daily", "EUR", "Eligible", "Generated eligible campaign", "91.0%", "Search", 20, 405, 18.5, "2.90%", r2(370 / 405), "68.40%", 13500, "3.00%", 370, "1.08"],
  ];
  const googleRows = [
    ["Campaign report"],
    ["October 15, 2026 - November 13, 2026"],
    ["Campaign status", "Campaign", "Budget", "Budget name", "Budget type", "Currency code", "Status", "Status reasons", "Optimization score", "Campaign type", "Conversions", "Clicks", "Cost / conv.", "Viewable CTR", "Avg. CPC", "% Engaged sessions (GA4)", "Impr.", "CTR", "Cost", "Relative CTR"],
    ...g,
    ["Total: Account", "Synthetic account total", null, null, null, "EUR", null, null, null, null, 270.5, 5805, null, null, null, null, 193500, "3.00%", 5370, null],
    ["Total: Campaigns", "Synthetic campaigns total", null, null, null, "EUR", null, null, null, null, 270.5, 5805, null, null, null, null, 193500, "3.00%", 5370, null],
  ];

  // YOUTUBE — content summary sheet and daily views sheet (two views of the same activity).
  const yt = [["Synthetic video A", 8000, 420.5, 40, 90000, 4.5], ["Synthetic video B", 5350, 280.25, 25, 60000, 4], ["Synthetic video C", 3000, 150.75, 10, 40000, 3.5]];
  const ytDaily = [];
  for (let i = 0; i < 30; i++) ytDaily.push([day(i), 400 + 10 * i]);
  const youtube = {
    format: "xlsx",
    sheets: [
      { name: "Table data", rows: [["Content", "Views", "Watch time (hours)", "Subscribers", "Thumbnail impressions", "Thumbnail click-through rate (%)"], ["Total", 16350, 851.5, 75, 190000, 4.13], ...yt] },
      { name: "Chart data", rows: [["Date", "Views"], ["Total", 16350], ...ytDaily] },
    ],
  };

  // SPOTIFY — summary sheet with repeated blocks (headers rows 8, 14, 19, 25) + daily detail sheets.
  const formats = [["Audio", 3], ["Video", 2], ["Podcast", 3], ["Display", 2]];
  const summary = [["Spotify Ad Studio — synthetic demo"], ["Campaign: Synthetic Audio Demo"], ["Order: SYN-ORDER-1"], ["Reporting period: 2026-10-15 - 2026-11-13"], [], [], ["Delivery summary"]];
  const detailSheets = [];
  let k = 0;
  for (const [fmt, count] of formats) {
    const playback = true; // Display progression is a generated exposure-duration cohort, not audio playback.
    summary.push(["Format", "Creative", "Impressions", "Clicks", "CTR"]);
    const detail = [["Order", "Line item", "Creative", "Date", "Ad server impressions", "Ad server clicks", "Ad server CTR", "Start", "First quartile", "Midpoint", "Third quartile", "Complete", "Completion rate"]];
    let fi = 0, fc = 0;
    for (let c = 0; c < count; c++, k++) {
      const creative = "Synthetic " + fmt.toLowerCase() + " creative " + (c + 1);
      let ci = 0, cc = 0;
      for (let i = 0; i < 30; i++) {
        const impr = 1000 + 50 * k + 10 * i, clicks = 3 + ((k + i) % 4), start = impr - 20 - k;
        ci += impr; cc += clicks;
        detail.push(["SYN-ORDER-1", "Synthetic " + fmt.toLowerCase() + " line", creative, day(i), impr, clicks, r2((clicks / impr) * 100),
          playback ? start : null, playback ? start - 50 : null, playback ? start - 100 : null, playback ? start - 150 : null, playback ? start - 200 : null,
          playback ? r2(((start - 200) / start) * 100) : null]);
      }
      fi += ci; fc += cc;
      summary.push([fmt, creative, ci, cc, r2((cc / ci) * 100)]);
    }
    summary.push(["Total", null, fi, fc, r2((fc / fi) * 100)]);
    summary.push([]);
    detailSheets.push({ name: fmt + " detail", rows: detail });
  }
  summary.pop();

  // GA4 — nine metadata lines, header row 10, period totals per channel group.
  const ch = [["Organic Search", 4200, 2900, 60, 8, 120, 100, 5400.5], ["Paid Social", 3100, 1800, 65, 9, 140, 120, 6200], ["Paid Search", 2600, 1700, 70, 10, 160, 130, 7800.25], ["Direct", 1900, 1300, 75, 11, 60, 50, 2100], ["Referral", 700, 420, 80, 12, 15, 12, 600], ["Unassigned", 150, 40, 85, 13, 0, 0, 0]];
  const ga4Rows = [["# ----------------------------------------"], ["# Traffic acquisition: Session primary channel group (Default Channel Group)"], ["# Account: Synthetic demo account"], ["# Property: Synthetic demo property"], ["# ----------------------------------------"], ["#"], ["# Start date: 20261015"], ["# End date: 20261113"], ["# Synthetic: generated demo data"],
    ["Session primary channel group (Default Channel Group)", "Sessions", "Engaged sessions", "Engagement rate", "Average engagement time per session", "Events per session", "Event count", "Key events", "Session key event rate", "Total revenue"]];
  const tot = [0, 0, 0, 0, 0, 0];
  for (const [name, s, e, avg, eps, ke, kes, rev] of ch) {
    ga4Rows.push([name, s, e, r4(e / s), avg, eps, s * eps, ke, r4(kes / s), rev]);
    tot[0] += s; tot[1] += e; tot[2] += s * eps; tot[3] += ke; tot[4] += rev;
  }
  ga4Rows.push(["Total", tot[0], tot[1], r4(tot[1] / tot[0]), null, null, tot[2], tot[3], null, tot[4]]);

  // LWM 1 / 3 — legacy XLS, metadata above, header row 10 in B-D, Total row below.
  const lwmLegacy = (n, start, days, imprF, clickF, label) => {
    const rows = [[null, "LWM network report — synthetic"], [null, "Campaign: " + label], [null, "Advertiser: Synthetic demo"], [null, "Report period: " + day(start) + " - " + day(start + days - 1)], [null, "Inventory: synthetic-lwm-inv-" + n + " (distinct generated inventory)"], [], [], [], [], [null, "Day", "Impr.", "Clicks", "Generated cost (EUR)", "Generated reach"]];
    let ti = 0, tc = 0;
    for (let j = 0; j < days; j++) { const im = imprF(j), cl = clickF(j); ti += im; tc += cl; rows.push([null, dmy(day(start + j)), im, cl, r2(im * 0.003), Math.floor(im * 0.7)]); }
    rows.push([null, "Total", ti, tc, r2(ti * 0.003), Math.floor(ti * 0.7)]);
    return { format: "xls", sheets: [{ name: "Report", rows }] };
  };

  // LWM 2 — XLSX daily table header row 5 (B-I) and site table header row 18 (B-I).
  const lwm2 = [[null, "LWM 2 delivery report — synthetic"], [null, "Campaign: Synthetic LWM Video 2"], [null, "Inventory: synthetic-lwm-inv-2 (distinct generated inventory)"], [], [null, "Days", "Impressions", "Daily Reach", "Clicks", "CTR", "CPC", "CPM", "Amount"]];
  let l2i = 0, l2c = 0, l2a = 0;
  for (let j = 0; j < 10; j++) {
    const im = 4000 + 200 * j, re = 3000 + 150 * j, cl = 8 + j, am = r2(im * 0.004);
    l2i += im; l2c += cl; l2a += am;
    lwm2.push([null, day(17 + j), im, re, cl, r2((cl / im) * 100), r2(am / cl), r2((am / im) * 1000), am]);
  }
  l2a = r2(l2a);
  lwm2.push([null, "Total", l2i, null, l2c, r2((l2c / l2i) * 100), r2(l2a / l2c), r2((l2a / l2i) * 1000), l2a]);
  lwm2.push([]);
  lwm2.push([null, "Sites", "Impressions", "Daily Reach", "Clicks", "CTR", "CPC", "CPM", "Amount"]);
  for (const [site, im, re, cl, am] of [["synthetic-news.example", 25000, 18000, 60, 100], ["synthetic-sport.example", 15000, 11000, 40, 60], ["synthetic-weather.example", 9000, 7000, 25, 36]]) {
    lwm2.push([null, site, im, re, cl, r2((cl / im) * 100), r2(am / cl), r2((am / im) * 1000), am]);
  }
  lwm2.push([null, "Total", l2i, null, l2c, r2((l2c / l2i) * 100), r2(l2a / l2c), r2((l2a / l2i) * 1000), l2a]);

  // TV — header row 2, one row per flight period, Total row, then report metadata labels.
  const tv = [["TV campaign report — synthetic"],
    ["Campaign", "Period", "GRPs (TTL)", "Reach 1+ (TTL)", "Reach 3+ (TTL)", "TRPs (all 16+)", "Reach 1+ (all 16+)", "Reach 3+ (all 16+)", "Net Cost", "note"],
    ["Synthetic TV Autumn", "15.10.2026 - 31.10.2026", 180.5, 52.3, 28.1, 210.2, 58.4, 31.6, 12000, "Synthetic flight 1"],
    ["Synthetic TV Autumn", "01.11.2026 - 13.11.2026", 140, 45.2, 22.4, 162.8, 50.1, 25.9, 9500, "Synthetic flight 2"],
    ["Total", null, 320.5, null, null, 373, null, null, 21500, null],
    [],
    ["TTL universe: all individuals 4+ (synthetic)"],
    ["16+ universe: all individuals 16+ (synthetic)"]];

  // Complete demo ledger. It is a separate explicit simulation, never an extra export to sum.
  // Integer allocations preserve source period totals exactly; money uses integer cents.
  const alloc = (total, i, n = 30, scale = 1) => (Math.floor(total * scale * (i + 1) / n) - Math.floor(total * scale * i / n)) / scale;
  const channels = ["meta", "google_ads", "youtube", "spotify", "ga4", "lwm", "tv", "stores"];
  const header = ["Date", "Channel", "Spend EUR", "Impressions", "Reach", "Clicks", "Website sessions", "Product views", "Add to basket", "Checkout", "Purchases", "Revenue EUR", "Post engagements", "Video views", "Playback starts", "First quartile", "Midpoint", "Third quartile", "Completes", "Watch hours", "Subscribers", "Thumbnail impressions", "Thumbnail clicks", "Users", "New users", "Engaged sessions", "Engagement seconds", "Event count", "Key events", "Key event sessions", "GRPs TTL", "TRPs 16+", "Reach 1 TTL pct", "Reach 3 TTL pct", "Reach 1 16 pct", "Reach 3 16 pct", "Footfall before", "Footfall during", "Footfall after", "Sales documents", "Quantity", "Net sales EUR", "Allocation", "Reach cohort start", "Reach universe"];
  const ledgerSheets = [];
  for (const channel of channels) {
    const rows = [header];
    for (let i = 0; i < 30; i++) {
      let spend, impr, clicks, sessions, views, basket, checkout, purchases, revenue;
      let allocation = "Generated daily observation";
      if (channel === "meta" || channel === "google_ads") {
        const m = channel === "meta";
        spend = m ? 100 + i : 150 + 2 * i; impr = m ? 10000 + 100 * i : 5000 + 100 * i; clicks = m ? 200 + 2 * i : 150 + 3 * i;
        sessions = (m ? 140 : 120) + 2 * i; views = (m ? 110 : 100) + i; basket = (m ? 24 : 30) + i % 7; checkout = (m ? 12 : 18) + i % 5; purchases = (m ? 5 : 8) + i % 3;
        revenue = purchases * ((m ? 80 : 90) + 5 * (i % 4));
      } else {
        if (channel === "youtube") { impr = alloc(190000, i); clicks = alloc(7850, i); spend = alloc(1635, i, 30, 100); }
        if (channel === "spotify") { const all = detailSheets.flatMap(s => s.rows.slice(1)).filter(r => r[3] === day(i)); impr = all.reduce((t,r)=>t+r[4],0); clicks = all.reduce((t,r)=>t+r[5],0); spend = r2(impr * 0.005); }
        if (channel === "lwm") {
          const l1 = i < 14 ? 3000 + 100 * i : 0, l3 = i >= 14 ? 2500 + 80 * (i - 14) : 0, l2 = i >= 17 && i < 27 ? 4000 + 200 * (i - 17) : 0;
          impr = l1+l2+l3; clicks = (l1 ? 6 + i % 5 : 0) + (l3 ? 5 + (i-14) % 4 : 0) + (l2 ? 8 + i-17 : 0); spend = r2((l1+l3)*0.003+l2*0.004);
        }
        if (channel === "tv") { const first = i < 17, j = first ? i : i-17, n = first ? 17 : 13; impr = alloc(first ? 680000 : 520000,j,n); clicks = 0; spend = alloc(first ? 12000 : 9500,j,n,100); allocation = "Simulated daily allocation of fixed flight totals; responses are not measured TV clicks"; }
        if (channel === "ga4") { impr = alloc(12650,i); clicks = 0; spend = 0; allocation = "Simulated daily allocation of site-wide period observations; not campaign attribution"; }
        if (channel === "stores") { impr = 280 + 4*i; clicks = 0; spend = 20 + i%4; allocation = "Generated store visits and offline sales; separate from website revenue"; }
        sessions = channel === "ga4" ? ch.reduce((t,r)=>t+alloc(r[1],i),0) : channel === "stores" ? impr : channel === "tv" ? 90 + 2*i : channel === "lwm" ? 28+i : Math.floor(clicks * 0.72);
        views = Math.floor(sessions * 0.75); basket = Math.floor(views * 0.28); checkout = Math.floor(basket * 0.62); purchases = Math.max(1,Math.floor(checkout * 0.65)); revenue = purchases*(85 + 5*(i%4));
        if (channel === "ga4") revenue = r2(ch.reduce((t,r)=>t+alloc(r[7],i,30,100),0));
        if (channel === "stores") { purchases = 35+i%6; checkout = purchases+9; basket = checkout+15; revenue=purchases*(52+i%4); }
      }
      if (channel === "ga4" || channel === "stores") impr = sessions;
      const reach = channel === "meta" ? 7000+50*i : Math.floor(impr*0.7);
      const engaged = channel === "ga4" ? ch.reduce((t,r)=>t+alloc(r[2],i),0) : Math.floor(sessions*0.68);
      const eventCount = channel === "ga4" ? ch.reduce((t,r)=>t+alloc(r[1]*r[4],i),0) : views+basket+checkout+purchases+sessions;
      const keyEvents = channel === "ga4" ? ch.reduce((t,r)=>t+alloc(r[5],i),0) : purchases;
      const keySessions = channel === "ga4" ? ch.reduce((t,r)=>t+alloc(r[6],i),0) : purchases;
      const sp = detailSheets.flatMap(s=>s.rows.slice(1)).filter(r=>r[3]===day(i));
      const playback = channel === "spotify" ? sp.reduce((t,r)=>t+r[7],0) : Math.floor(impr*0.6);
      const milestone = (index,scale) => channel === "spotify" ? sp.reduce((t,r)=>t+r[index],0) : Math.floor(playback*scale);
      const videoViews = channel === "youtube" ? 400+10*i : Math.floor(playback*0.8);
      const flightFirst=i<17, flightIx=flightFirst?i:i-17, flightDays=flightFirst?17:13;
      rows.push([day(i),channel,spend,impr,reach,clicks,sessions,views,basket,checkout,purchases,revenue,
        channel === "meta" ? 350+3*i : Math.floor(clicks*1.4),videoViews,playback,milestone(8,0.9),milestone(9,0.82),milestone(10,0.74),milestone(11,0.66),
        alloc(851.5,i,30,100),alloc(75,i),alloc(190000,i),alloc(7850,i),Math.floor(sessions*0.84),Math.floor(sessions*0.48),engaged,channel === "ga4" ? ch.reduce((t,r)=>t+alloc(r[1]*r[3],i),0) : sessions*(60+i%7),eventCount,keyEvents,keySessions,
        channel === "tv" ? alloc(flightFirst?180.5:140,flightIx,flightDays,100) : 0,channel === "tv" ? alloc(flightFirst?210.2:162.8,flightIx,flightDays,100) : 0,
        flightFirst?52.3:45.2,flightFirst?28.1:22.4,flightFirst?58.4:50.1,flightFirst?31.6:25.9,
        220+3*i,channel === "stores" ? sessions : 280+4*i,250+3*i,purchases,purchases*2,revenue,allocation,(i*733)%50000,50000]);
    }
    ledgerSheets.push({name:channel,rows});
  }

  return {
    metadata: { synthetic: true, schema_version: "sources.v2", campaign: "Synthetic Autumn Demo", period_start: day(0), period_end: day(29), note: "Wholly generated demo data. Not real Neptun performance." },
    sources: {
      meta: { format: "csv", sheets: [{ name: "Meta export", rows: metaRows }] },
      google_ads: { format: "csv", sheets: [{ name: "Campaign report", rows: googleRows }] },
      youtube,
      spotify: { format: "xlsx", sheets: [{ name: "Summary", rows: summary }, ...detailSheets] },
      ga4: { format: "csv", sheets: [{ name: "Traffic acquisition", rows: ga4Rows }] },
      lwm1: lwmLegacy(1, 0, 14, (j) => 3000 + 100 * j, (j) => 6 + (j % 5), "Synthetic LWM Display 1"),
      lwm2: { format: "xlsx", sheets: [{ name: "Report", rows: lwm2 }] },
      lwm3: lwmLegacy(3, 14, 16, (j) => 2500 + 80 * j, (j) => 5 + (j % 4), "Synthetic LWM Display 3"),
      tv: { format: "xlsx", sheets: [{ name: "TV", rows: tv }] },
      simulation: { format: "xlsx", sheets: ledgerSheets },
    },
  };
}
