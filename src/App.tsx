import TriNetLogo from "./assets/trinet_white_rgb_md.png";
import React, { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  getDay,
  getDaysInMonth,
  isAfter,
  isBefore,
  setDate,
  startOfMonth,
} from "date-fns";
import { Card, CardContent } from "./components/ui/card";
import { motion } from "framer-motion";

type ServiceModel = "Core" | "Preferred";
type EarlyAccessOption = "None" | "1 week" | "2 weeks" | "3 weeks" | "30 days";

function clampToMidnight(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function isWeekend(d: Date) {
  const day = d.getDay();
  return day === 0 || day === 6;
}
function observedDate(d: Date) {
  const day = d.getDay();
  if (day === 6) return addDays(d, -1);
  if (day === 0) return addDays(d, 1);
  return d;
}
function nthWeekdayOfMonth(year: number, monthZero: number, weekday: number, nth: number) {
  const first = new Date(year, monthZero, 1);
  const offset = (7 + weekday - first.getDay()) % 7;
  return new Date(year, monthZero, 1 + offset + 7 * (nth - 1));
}
function lastWeekdayOfMonth(year: number, monthZero: number, weekday: number) {
  const last = endOfMonth(new Date(year, monthZero, 1));
  const offset = (7 + last.getDay() - weekday) % 7;
  return addDays(last, -offset);
}
function usFederalHolidaysObserved(year: number): Set<string> {
  const dates: Date[] = [];
  dates.push(observedDate(new Date(year, 0, 1)));
  dates.push(nthWeekdayOfMonth(year, 0, 1, 3));
  dates.push(nthWeekdayOfMonth(year, 1, 1, 3));
  dates.push(lastWeekdayOfMonth(year, 4, 1));
  dates.push(observedDate(new Date(year, 5, 19)));
  dates.push(observedDate(new Date(year, 6, 4)));
  dates.push(nthWeekdayOfMonth(year, 8, 1, 1));
  dates.push(nthWeekdayOfMonth(year, 9, 1, 2));
  dates.push(observedDate(new Date(year, 10, 11)));
  dates.push(nthWeekdayOfMonth(year, 10, 4, 4));
  dates.push(observedDate(new Date(year, 11, 25)));
  const set = new Set<string>();
  for (const d of dates) set.add(format(d, "yyyy-MM-dd"));
  return set;
}
function isFederalHolidayObserved(d: Date) {
  const year = d.getFullYear();
  const set = usFederalHolidaysObserved(year);
  return set.has(format(d, "yyyy-MM-dd"));
}
function subtractBusinessDays(date: Date, businessDays: number) {
  let d = clampToMidnight(date);
  let remaining = businessDays;
  while (remaining > 0) {
    d = addDays(d, -1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return d;
}
function nextSemiMonthlyPeriod(prevEnd: Date): { begin: Date; end: Date } {
  const nextDay = addDays(prevEnd, 1);
  const y = nextDay.getFullYear();
  const m = nextDay.getMonth();
  const eom = endOfMonth(nextDay);
  if (nextDay.getDate() <= 15) {
    return { begin: setDate(new Date(y, m, 1), 1), end: setDate(new Date(y, m, 15), 15) };
  } else {
    return { begin: setDate(new Date(y, m, 16), 16), end: setDate(eom, eom.getDate()) };
  }
}
function addMonthlyLike(begin: Date, end: Date): { begin: Date; end: Date } {
  const lengthInclusive = differenceInCalendarDays(end, begin) + 1;
  const nb = addMonths(begin, 1);
  let ne = addDays(nb, lengthInclusive - 1);
  const eom = endOfMonth(nb);
  if (isAfter(ne, eom)) ne = eom;
  return { begin: nb, end: ne };
}
function earlyAccessOffset(opt: EarlyAccessOption): number {
  if (opt === "1 week") return -7;
  if (opt === "2 weeks") return -14;
  if (opt === "3 weeks") return -21;
  if (opt === "30 days") return -28;
  return 0;
}

type Period = {
  begin: Date;
  end: Date;
  check: Date;
  benefitsStart: Date;
  deadline?: Date;
};

export default function App() {
  const [frequency, setFrequency] = useState("bi-weekly");
  const [payBegin, setPayBegin] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [payEnd, setPayEnd] = useState<string>(format(addDays(new Date(), 13), "yyyy-MM-dd"));
  const [firstCheck, setFirstCheck] = useState<string>(format(addDays(new Date(), 20), "yyyy-MM-dd"));
  const [benefitsStart, setBenefitsStart] = useState<string>(format(addDays(new Date(), 30), "yyyy-MM-dd"));
  const [employeeCount, setEmployeeCount] = useState<number>(25);
  const [serviceModel, setServiceModel] = useState<ServiceModel>("Core");
  const [earlyAccess, setEarlyAccess] = useState<EarlyAccessOption>("None");

  const toDate = (s: string) => new Date(s + (s.length === 10 ? "T00:00:00" : ""));

  function generatePeriods(): Period[] {
    const startBegin = clampToMidnight(toDate(payBegin));
    const startEnd = clampToMidnight(toDate(payEnd));
    const startCheck = clampToMidnight(toDate(firstCheck));
    const startBenefits = clampToMidnight(toDate(benefitsStart));

    function deadlineOffsetBD(emp: number, model: ServiceModel): number | null {
      const bandsCore = [
        { min: 0, max: 29, bd: 17 },
        { min: 30, max: 73, bd: 22 },
        { min: 74, max: 248, bd: 27 },
        { min: 249, max: 499, bd: 32 },
      ];
      const bandsPref = [
        { min: 0, max: 29, bd: 22 },
        { min: 30, max: 73, bd: 27 },
        { min: 74, max: 248, bd: 32 },
        { min: 249, max: 499, bd: 37 },
      ];
      if (emp >= 500) return null;
      const bands = model === "Core" ? bandsCore : bandsPref;
      const found = bands.find((b) => emp >= b.min && emp <= b.max);
      return found ? found.bd : null;
    }

    const bd = deadlineOffsetBD(employeeCount, serviceModel);

    const eaActive = earlyAccess !== "None" && employeeCount >= 10;
    const eaRaw = eaActive ? addDays(startBegin, earlyAccessOffset(earlyAccess)) : undefined;
    const eaDate = (() => {
      if (!eaRaw) return undefined;
      const wd = eaRaw.getDay();
      if (earlyAccess === "30 days") {
        if (wd === 6) return addDays(eaRaw, 2); // Sat -> Mon
        if (wd === 0) return addDays(eaRaw, 1); // Sun -> Mon
        return eaRaw;
      }
      if (wd === 6) return addDays(eaRaw, -1); // Sat -> Fri
      if (wd === 0) return addDays(eaRaw, -2); // Sun -> Fri
      return eaRaw;
    })();

    let eaDeadline: Date | undefined;
    if (eaActive && eaDate) {
      const offset = 12; // unified rule: 12 business days prior to Early Access date
      eaDeadline = subtractBusinessDays(eaDate, offset);
    }

    let firstDeadline = eaDeadline ?? (bd != null ? subtractBusinessDays(startCheck, bd) : undefined);
    if (!eaActive && firstDeadline) {
      const minAllowed = subtractBusinessDays(startBegin, 8);
      if (isAfter(firstDeadline, minAllowed)) firstDeadline = minAllowed;
    }

    const periods: Period[] = [];
    function pushPeriod(b: Date, e: Date, c: Date, includeDeadline: boolean) {
      const deadline = includeDeadline ? firstDeadline : undefined;
      periods.push({ begin: b, end: e, check: c, benefitsStart: startBenefits, deadline });
    }

    pushPeriod(startBegin, startEnd, startCheck, true);

    const countAdditional = 6;
    let b = startBegin;
    let e = startEnd;
    let c = startCheck;
    const endToCheckLagDays = differenceInCalendarDays(startCheck, startEnd);

    for (let i = 0; i < countAdditional; i++) {
      switch (frequency) {
        case "weekly":
          b = addDays(b, 7); e = addDays(e, 7); c = addDays(c, 7); break;
        case "bi-weekly":
          b = addDays(b, 14); e = addDays(e, 14); c = addDays(c, 14); break;
        case "semi monthly": {
          const next = nextSemiMonthlyPeriod(e);
          b = next.begin; e = next.end; c = addDays(e, endToCheckLagDays); break;
        }
        case "monthly": {
          const next = addMonthlyLike(b, e);
          b = next.begin; e = next.end; c = addDays(e, endToCheckLagDays); break;
        }
      }
      pushPeriod(b, e, c, false);
    }

    return periods;
  }

  const periods = useMemo(generatePeriods, [
    frequency, payBegin, payEnd, firstCheck, benefitsStart, employeeCount, serviceModel, earlyAccess,
  ]);

  type DayLabels = { [iso: string]: string[] };
  const labelMap: DayLabels = useMemo(() => {
    const map: DayLabels = {};
    const add = (d: Date, label: string) => {
      const k = format(d, "yyyy-MM-dd");
      if (!map[k]) map[k] = [];
      if (!map[k].includes(label)) map[k].push(label);
    };

    const startBegin = clampToMidnight(new Date(payBegin + "T00:00:00"));
    const eaActive = earlyAccess !== "None" && employeeCount >= 10;
    const eaRaw = eaActive ? addDays(startBegin, earlyAccessOffset(earlyAccess)) : undefined;
    const eaDate = (() => {
      if (!eaRaw) return undefined;
      const wd = eaRaw.getDay();
      if (earlyAccess === "30 days") {
        if (wd === 6) return addDays(eaRaw, 2);
        if (wd === 0) return addDays(eaRaw, 1);
        return eaRaw;
      }
      if (wd === 6) return addDays(eaRaw, -1);
      if (wd === 0) return addDays(eaRaw, -2);
      return eaRaw;
    })();

    periods.forEach((p, idx) => {
      add(p.begin, "Pay Period Start");
      add(p.end, "Pay Period End");
      add(p.check, "Check Date");
      if (idx === 0 && p.deadline) add(p.deadline, "Paperwork Deadline");
      add(p.benefitsStart, "Benefits Start Date");
    });

    if (eaDate) add(eaDate, "Early Access Start Date");
    return map;
  }, [periods, payBegin, earlyAccess, employeeCount]);

  const priorMonthsNeeded = useMemo(() => {
    const baseStart = startOfMonth(new Date(payBegin + "T00:00:00"));
    let need = 0;
    for (let k = 1; k <= 2; k++) {
      const mStart = addMonths(baseStart, -k);
      const mEnd = endOfMonth(mStart);
      const has = Object.keys(labelMap).some((iso) => {
        const d = new Date(iso + "T00:00:00");
        return d >= mStart && d <= mEnd;
      });
      if (has) need = k;
    }
    return need;
  }, [labelMap, payBegin]);

  const monthStarts = useMemo(() => {
    const baseStart = startOfMonth(new Date(payBegin + "T00:00:00"));
    const start = addMonths(baseStart, -priorMonthsNeeded);
    const count = 7 + priorMonthsNeeded;
    return Array.from({ length: count }, (_, i) => addMonths(start, i));
  }, [payBegin, priorMonthsNeeded]);

  const brandVars = {
    "--brand-primary": "#0B0134",
    "--brand-secondary": "#FD5000",
    "--bg": "#FD5000",
    "--panel": "#0f172a",
    "--text": "#e5e7eb",
  } as React.CSSProperties;

  const labelClass = (label: string) => {
    if (label === "Pay Period Start") return "chip-secondary";
    if (label === "Pay Period End") return "chip-primary";
    if (label === "Check Date") return "chip-neutral";
    if (label === "Paperwork Deadline") return "chip-deadline";
    if (label === "Benefits Start Date") return "chip-benefit";
    if (label === "Early Access Start Date") return "chip-early";
    return "chip-neutral";
  };

  const validationErrors = useMemo(() => {
    const errs: string[] = [];
  
    const b  = clampToMidnight(new Date(payBegin + "T00:00:00"));
    const e  = clampToMidnight(new Date(payEnd + "T00:00:00"));
    const c  = clampToMidnight(new Date(firstCheck + "T00:00:00"));
    const bs = clampToMidnight(new Date(benefitsStart + "T00:00:00"));
  
    if (isBefore(e, b)) {
      errs.push("Pay period end date cannot be before pay period begin date.");
    }
    if (isBefore(bs, b)) {
      errs.push("Benefits start date cannot be before the first pay period begins.");
    }
    if (differenceInCalendarDays(bs, b) > 30) {
      errs.push("Benefits start date must be within 30 days of the pay period begin date.");
    }
    if (isWeekend(c) || isFederalHolidayObserved(c)) {
      errs.push("Check date cannot fall on a weekend or federal holiday.");
    }
    if (earlyAccess !== "None" && employeeCount < 10) {
      errs.push("Early Access requires at least 10 employees.");
    }
    if (employeeCount >= 500) {
      errs.push("Custom Timeline Required! - please submit sales support case");
    }
  
    return errs;
  }, [payBegin, payEnd, firstCheck, benefitsStart, earlyAccess, employeeCount]);
  
  // ✅ Non-blocking warnings (separate hook!)
  const warningMessages = useMemo(() => {
    const msgs: string[] = [];
  
    const bs = clampToMidnight(new Date(benefitsStart + "T00:00:00"));
    const day = bs.getDate();
  
    // 2nd–15th → billed for entire month
    if (day > 1 && day < 16) {
      msgs.push("Client will be billed for the entire month.");
    }
    // anything but the 1st → no deductible credit
    if (day !== 1) {
      msgs.push("Client will not be eligible for deductible credit.");
    }
  
    return msgs;
  }, [benefitsStart]);

  
  return (
    <div
      className="min-h-screen bg-[var(--bg)] text-[var(--text)]"
      style={{
        ...brandVars,
        fontFamily:
          "'Avenir Next','Avenir',system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif",
      }}
    >
      <div className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
        <img src={TriNetLogo} alt="TriNet Logo" className="h-8 w-auto" />
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">TriNet Paperwork Deadlines</h1>
            <p className="text-sm text-slate-300">Interactive payroll calendar with business-day paperwork deadlines.</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6" style={brandVars}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1 shadow-sm bg-[var(--panel)] border-slate-800">
            <CardContent className="p-4 sm:p-6">
              <h2 className="text-lg font-semibold mb-4 text-white">Inputs</h2>
              <div className="space-y-4">
                <div>
                <label className="block text-sm font-medium mb-1 text-[var(--brand-primary)]">Payroll frequency</label>
                  <select className="w-full border border-slate-700 bg-slate-900 rounded-lg px-3 py-2 text-slate-100" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                    <option>weekly</option>
                    <option>bi-weekly</option>
                    <option>semi monthly</option>
                    <option>monthly</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                  <label className="block text-sm font-medium mb-1 text-[var(--brand-primary)]">Pay period begin date</label>
                    <input type="date" className="dark-date w-full border border-slate-700 bg-slate-900 rounded-lg px-3 py-2 text-slate-100" value={payBegin} onChange={(e) => setPayBegin(e.target.value)} />
                  </div>
                  <div>
                  <label className="block text-sm font-medium mb-1 text-[var(--brand-primary)]">Pay period end date</label>
                    <input type="date" className="dark-date w-full border border-slate-700 bg-slate-900 rounded-lg px-3 py-2 text-slate-100" value={payEnd} onChange={(e) => setPayEnd(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                  <label className="block text-sm font-medium mb-1 text-[var(--brand-primary)]">First check date</label>
                    <input type="date" className="dark-date w-full border border-slate-700 bg-slate-900 rounded-lg px-3 py-2 text-slate-100" value={firstCheck} onChange={(e) => setFirstCheck(e.target.value)} />
                  </div>
                  <div>
                  <label className="block text-sm font-medium mb-1 text-[var(--brand-primary)]">Benefits start date</label>
                    <input type="date" className="dark-date w-full border border-slate-700 bg-slate-900 rounded-lg px-3 py-2 text-slate-100" value={benefitsStart} onChange={(e) => setBenefitsStart(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                  <label className="block text-sm font-medium mb-1 text-[var(--brand-primary)]">Employee count</label>
                    <input
                      type="number"
                      min={1}
                      className="w-full border border-slate-700 bg-slate-900 rounded-lg px-3 py-2 text-slate-100"
                      value={employeeCount}
                      onChange={(e) => setEmployeeCount(parseInt(e.target.value || "0"))}
                    />
                  </div>
                  <div>
                  <label className="block text-sm font-medium mb-1 text-[var(--brand-primary)]">Service model</label>
                    <select
                      className="w-full border border-slate-700 bg-slate-900 rounded-lg px-3 py-2 text-slate-100"
                      value={serviceModel}
                      onChange={(e) => setServiceModel(e.target.value as ServiceModel)}
                    >
                      <option>Core</option>
                      <option>Preferred</option>
                    </select>
                  </div>
                </div>

                <div>
                <label className="block text-sm font-medium mb-1 text-[var(--brand-primary)]">Early Access</label>
                  <select
                    className="w-full border border-slate-700 bg-slate-900 rounded-lg px-3 py-2 text-slate-100"
                    value={earlyAccess}
                    onChange={(e) => setEarlyAccess(e.target.value as EarlyAccessOption)}
                  >
                    <option>None</option>
                    <option>1 week</option>
                    <option>2 weeks</option>
                    <option>3 weeks</option>
                    <option>30 days</option>
                  </select>
                </div>

                {validationErrors.length > 0 && (
  <div
    role="alert"
    className="rounded-lg border border-red-600 bg-red-600/10 p-3 text-sm text-red-500"
  >
    <ul className="list-disc pl-5 space-y-1">
      {validationErrors.map((e, i) => (
        <li key={i} className="font-bold text-red-500">
          {e}
        </li>
      ))}
    </ul>
  </div>
)}


{warningMessages.length > 0 && (
  <div className="rounded-lg border border-red-600 bg-red-600/10 p-3 text-sm text-red-500">
    {warningMessages.map((w, i) => (
      <div key={i}>• {w}</div>
    ))}
  </div>
)}

<div className="mt-4 space-y-2">
  <h3 className="text-sm font-semibold text-[var(--brand-primary)]">
    Reference Documents
  </h3>
  <ul className="text-sm list-disc pl-5 space-y-1">
    <li>
      <a
        href="https://trinet.highspot.com/items/66ec70cb761f18e9e1e595e1?lfrm=srp.0"
        target="_blank"
        rel="noreferrer"
        className="underline hover:opacity-80 text-[var(--brand-secondary)]"
      >
        2025 Core Paperwork Deadlines
      </a>
    </li>
    <li>
      <a
        href="https://trinet.highspot.com/items/66ec70cb761f18e9e1e595fd?lfrm=srp.1"
        target="_blank"
        rel="noreferrer"
        className="underline hover:opacity-80 text-[var(--brand-secondary)]"
      >
        2025 Preferred Paperwork Deadlines
      </a>
    </li>
    <li>
      <a
        href="https://trinet.highspot.com/items/66ec70cb761f18e9e1e595ef?lfrm=srp.2"
        target="_blank"
        rel="noreferrer"
        className="underline hover:opacity-80 text-[var(--brand-secondary)]"
      >
        2025 OMS Deadlines
      </a>
    </li>
    <li>
      <a
        href="https://trinet.highspot.com/items/68d43bbdcff4951ae2d47f81?lfrm=srp.3"
        target="_blank"
        rel="noreferrer"
        className="underline hover:opacity-80 text-[var(--brand-secondary)]"
      >
        2025 Core Paperwork Deadlines
      </a>
    </li>
    <li>
      <a
        href="https://trinet.highspot.com/items/68d43bbdcff4951ae2d47f8c?lfrm=srp.5"
        target="_blank"
        rel="noreferrer"
        className="underline hover:opacity-80 text-[var(--brand-secondary)]"
      >
        2026 Preferred Paperwork Deadlines
      </a>
    </li>
    <li>
      <a
        href="https://trinet.highspot.com/items/68ba2c9d2a8dc5545cf12f90?lfrm=srp.4"
        target="_blank"
        rel="noreferrer"
        className="underline hover:opacity-80 text-[var(--brand-secondary)]"
      >
        2026 OMS Paperwork Deadlines
      </a>
    </li>
  </ul>
</div>

                <div className="text-xs text-slate-400">
                  <p>Business days exclude Saturdays and Sundays. Federal holidays are observed on nearest weekday when they fall on weekends.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="lg:col-span-2 space-y-6">
            {monthStarts.map((ms, idx) => (
              <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: idx * 0.04 }}>
                <MonthCard date={ms} labelMap={labelMap} labelClass={labelClass} />
              </motion.div>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <h3 className="text-base font-semibold mb-3 text-white">Legend</h3>
          <div className="flex flex-wrap gap-2">
            {["Pay Period Start", "Pay Period End", "Check Date", "Paperwork Deadline", "Benefits Start Date", "Early Access Start Date"].map((k) => (
              <span key={k} className={`px-2 py-1 rounded-lg text-xs ${labelClass(k)}`}>{k}</span>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        :root { --brand-primary:#0B0134; --brand-secondary:#FD5000; --bg:#0b0f1a; --panel:#0f172a; --text:#e5e7eb; }
        .chip-primary { color:#c7c9ff; background:rgba(99,102,241,.12); border:1px solid rgba(99,102,241,.35); }
        .chip-secondary { color:#ffd3c2; background:rgba(253,80,0,.12); border:1px solid rgba(253,80,0,.35); }
        .chip-neutral { color:#e5e7eb; background:rgba(148,163,184,.12); border:1px solid rgba(148,163,184,.35); }
        .chip-deadline { color:#fecaca; background:rgba(239,68,68,.12); border:1px solid rgba(239,68,68,.35); }
        .chip-benefit { color:#bbf7d0; background:rgba(16,185,129,.12); border:1px solid rgba(16,185,129,.35); }
        .chip-early { color:#bfdbfe; background:rgba(59,130,246,.12); border:1px solid rgba(59,130,246,.35); }
      `}</style>
    </div>
  );
}

function MonthCard({
  date,
  labelMap,
  labelClass,
}: {
  date: Date;
  labelMap: Record<string, string[]>;
  labelClass: (label: string) => string;
}) {
  const first = startOfMonth(date);
  const daysInMonth = getDaysInMonth(date);
  const startWeekday = getDay(first);
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => addDays(first, i));
  const leading = Array.from({ length: startWeekday }, () => null as unknown as Date | null);
  const cells = [...leading, ...monthDays];
  const rows = Math.ceil(cells.length / 7);
  const grid: (Date | null)[][] = [];
  for (let r = 0; r < rows; r++) grid.push(cells.slice(r * 7, r * 7 + 7) as (Date | null)[]);
  const monthTitle = format(date, "MMMM yyyy");
  return (
    <Card className="shadow-sm bg-[var(--panel)] border-slate-800">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-[var(--brand-primary)]">{monthTitle}</h3>
        </div>
        <div
        className="grid grid-cols-7 text-sm font-semibold mb-1"
        style={{ color: "var(--brand-primary)" }}
        >
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="px-2 py-1 text-center">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {grid.flat().map((d, idx) => (
            <div key={idx} className="border border-slate-700 rounded-xl min-h-[72px] p-1 bg-slate-900">
              {d ? (
                <div>
                  <div className="text-sm font-semibold mb-1 text-[var(--brand-secondary)]">{format(d, "d")}</div>
                  <div className="space-y-1">
                    {labelMap[format(d, "yyyy-MM-dd")]?.map((label, i) => (
                      <span key={i} className={`block text-[10px] leading-tight px-1 py-0.5 rounded ${labelClass(label)}`} title={label}>
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-full" />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

if (typeof window !== "undefined") {
  try {
    console.assert(isWeekend(new Date(2025, 0, 5)) === true);
    console.assert(isWeekend(new Date(2025, 0, 6)) === false);
    console.assert(earlyAccessOffset("1 week") === -7);
    console.assert(earlyAccessOffset("2 weeks") === -14);
    console.assert(earlyAccessOffset("3 weeks") === -21);
    console.assert(earlyAccessOffset("30 days") === -28);
    const monday = new Date(2025, 0, 20);
    const fiveBD = subtractBusinessDays(monday, 5);
    console.assert(format(fiveBD, "yyyy-MM-dd") === "2025-01-13");
  } catch {}
}
