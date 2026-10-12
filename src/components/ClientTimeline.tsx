import { format } from "date-fns";
import TriNetLogo from "../assets/trinet_white_rgb_md.png";

export type OnboardingStep = { date: string; title: string; detail: string; owner: string; milestone?: boolean; estimated?: boolean };
export type PayPeriodRow = { begin: Date; end: Date; check: Date };

const day = (s: string) => new Date(s + "T00:00:00");

// The onboarding plan as a vertical timeline: milestones in orange, estimated steps marked as such.
export function OnboardingTimeline({ steps }: { steps: OnboardingStep[] }) {
  return (
    <ol className="relative">
      <span className="absolute left-[88px] sm:left-[112px] top-2 bottom-2 w-0.5 bg-slate-200" aria-hidden />
      {steps.map((s) => (
        <li key={s.title + s.date} className="relative flex gap-4 sm:gap-6 py-2.5">
          <div className="w-[72px] sm:w-[96px] shrink-0 text-right">
            <p className="text-sm font-bold text-[#0B0134]">{format(day(s.date), "MMM d")}</p>
            <p className="text-xs text-slate-500">{format(day(s.date), "EEE, yyyy")}</p>
          </div>
          <span
            className={`relative z-10 mt-1 h-4 w-4 shrink-0 rounded-full border-[3px] ${s.milestone ? "border-[#FD5000] bg-[#FD5000]" : "border-[#0B0134] bg-white"}`}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="font-semibold text-[#0B0134]">
              {s.title}
              {s.estimated && (
                <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Estimated</span>
              )}
            </p>
            <p className="text-sm text-slate-600">{s.detail}</p>
            <p className="text-xs font-semibold text-[#8F3011]">{s.owner}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

// The client-facing timeline on one letter sheet. Hidden on screen; it is the only thing printed, so
// "Print / Save as PDF" produces a clean client document.
export function TimelineDocument({
  steps,
  periods,
  company,
  preparedBy,
}: {
  steps: OnboardingStep[];
  periods: PayPeriodRow[];
  company: string;
  preparedBy: string;
}) {
  const milestones = steps.filter((s) => s.milestone);
  const who = company.trim() || "Your company";
  return (
    <article className="print-only timeline-doc bg-white text-[#0B0134]" style={{ fontFamily: "'Avenir Next LT Pro','Avenir Next',Avenir,Arial,sans-serif" }}>
      <header className="relative bg-[#0B0134] px-[0.5in] pt-[0.35in] pb-[0.25in] text-white">
        <span className="absolute right-0 top-0 h-14 w-14 border-r-[14px] border-t-[14px] border-[#FD5000]" aria-hidden />
        <img src={TriNetLogo} alt="TriNet" className="h-6 w-auto" />
        <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-[#FD5000]">Onboarding timeline</p>
        <h1 className="text-[28px] font-bold leading-tight">Getting {who} live on TriNet</h1>
        <p className="mt-1 text-[12px] text-white/80">
          Prepared {format(new Date(), "MMMM d, yyyy")}
          {preparedBy.trim() && ` by ${preparedBy.trim()}`}
        </p>
      </header>

      <div className="px-[0.5in] py-[0.25in] text-[12px] leading-snug">
        <section>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#54565A]">Key dates</p>
          <ol className="relative grid gap-3" style={{ gridTemplateColumns: `repeat(${milestones.length}, minmax(0, 1fr))` }}>
            <span className="absolute left-0 right-0 top-[7px] h-0.5 bg-[#DFE1DF]" aria-hidden />
            {milestones.map((m) => (
              <li key={m.title + m.date} className="relative text-center">
                <span className="relative z-10 mx-auto block h-4 w-4 rounded-full border-[3px] border-[#FD5000] bg-white" aria-hidden />
                <p className="mt-2 text-[13px] font-bold">{format(day(m.date), "MMM d, yyyy")}</p>
                <p className="text-[11px] font-bold text-[#8F3011]">{m.title}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-5">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#54565A]">Step by step</p>
          <ol className="relative">
            <span className="absolute left-[86px] top-2 bottom-2 w-0.5 bg-[#DFE1DF]" aria-hidden />
            {steps.map((s) => (
              <li key={s.title + s.date} className="relative flex gap-4 py-[3px]" style={{ breakInside: "avoid" }}>
                <div className="w-[72px] shrink-0 text-right">
                  <p className="font-bold">{format(day(s.date), "MMM d")}</p>
                  <p className="text-[10px] text-[#54565A]">{format(day(s.date), "EEE, yyyy")}</p>
                </div>
                <span
                  className={`relative z-10 mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border-[3px] ${s.milestone ? "border-[#FD5000] bg-[#FD5000]" : "border-[#0B0134] bg-white"}`}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="font-bold">
                    {s.title}
                    {s.estimated && <span className="ml-2 text-[9px] font-semibold uppercase tracking-wider text-[#54565A]">Estimated</span>}
                  </p>
                  <p className="text-[11px] text-[#54565A]">
                    {s.detail} <span className="font-semibold text-[#8F3011]">{s.owner}</span>
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {periods.length > 0 && (
          <section className="mt-4" style={{ breakInside: "avoid" }}>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#54565A]">First TriNet pay periods</p>
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b-2 border-[#FD5000]">
                  <th className="py-1 font-bold">Pay period</th>
                  <th className="py-1 font-bold">Begins</th>
                  <th className="py-1 font-bold">Ends</th>
                  <th className="py-1 font-bold">Check date</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((p, i) => (
                  <tr key={i} className="border-b border-[#DFE1DF]">
                    <td className="py-1">{i + 1}</td>
                    <td className="py-1">{format(p.begin, "EEE, MMM d, yyyy")}</td>
                    <td className="py-1">{format(p.end, "EEE, MMM d, yyyy")}</td>
                    <td className="py-1 font-semibold">{format(p.check, "EEE, MMM d, yyyy")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <footer className="mt-4 border-t border-[#DFE1DF] pt-2 text-[9.5px] text-[#54565A]">
          <p>
            Estimated steps are confirmed by your Transition Consultant on the welcome call. Paperwork deadlines count business days, excluding
            weekends and TriNet holidays. Dates are for planning purposes and depend on paperwork being received complete by the deadline.
          </p>
        </footer>
      </div>
    </article>
  );
}
