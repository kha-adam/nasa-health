"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Bell, ClipboardCheck, HeartPulse, Users, X } from "lucide-react";
import { metricHref, openLog } from "@/lib/metrics";

const REMINDERS = {
  checkIn: { icon: ClipboardCheck, title: "Daily check-in", message: "Your daily check-in is due.", action: "Start check-in" },
  readings: { icon: HeartPulse, title: "Physical readings", message: "Take a moment to review your latest readings.", action: "Review readings" },
  crew: { icon: Users, title: "Crew Life", message: "See how your crew is doing on this week’s challenge.", action: "View Crew Life" },
};
type Reminder = keyof typeof REMINDERS;
const ROTATION: Reminder[] = ["checkIn", "readings", "crew"];
const MINUTE = 60_000;

export default function DashboardReminders({ checkInDue, astronautId }: { checkInDue: boolean; astronautId: string }) {
  const panel = useRef<HTMLDetailsElement>(null);
  const sequence = useRef(0);
  const [toast, setToast] = useState<Reminder | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      let next = ROTATION[sequence.current % ROTATION.length];
      sequence.current += 1;
      if (next === "checkIn" && !checkInDue) {
        next = ROTATION[sequence.current % ROTATION.length];
        sequence.current += 1;
      }
      setToast(next);
    }, MINUTE);
    return () => window.clearInterval(timer);
  }, [checkInDue]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 12_000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const dismiss = () => {
    setToast(null);
    if (panel.current) panel.current.open = false;
  };
  const action = (kind: Reminder) => {
    const { action: label } = REMINDERS[kind];
    return kind === "checkIn" ? (
      <button className="btn-soft mt-2 px-3 py-1.5 text-xs" onClick={() => { dismiss(); openLog(); }}>{label}</button>
    ) : (
      <Link className="btn-soft mt-2 px-3 py-1.5 text-xs" href={kind === "crew" ? "/dashboard/crew-life#challenge-title" : metricHref("heart_rate", astronautId, false)} onClick={dismiss}>{label}</Link>
    );
  };

  const visible = toast && (toast !== "checkIn" || checkInDue) ? REMINDERS[toast] : null;
  const ToastIcon = visible?.icon;

  return (
    <>
      <details ref={panel} onKeyDown={(event) => {
        if (event.key === "Escape" && panel.current?.open) {
          panel.current.open = false;
          panel.current.querySelector("summary")?.focus();
        }
      }}>
        <summary aria-label={checkInDue ? "Reminders, 1 pending" : "Reminders"} className="relative grid size-9 cursor-pointer list-none place-items-center rounded-full border border-[#83afd2] text-white hover:bg-[#195a90] [&::-webkit-details-marker]:hidden">
          <Bell size={16} aria-hidden />
          {checkInDue && <span className="absolute right-1 top-1 size-2 rounded-full bg-[#ffd179]" aria-hidden />}
        </summary>
        <section aria-label="Reminders" className="absolute right-0 top-full z-50 mt-2 w-64 max-w-[calc(100vw-24px)] rounded-xl border border-line-strong bg-white p-4 text-ink shadow-pop">
          <h2 className="text-sm font-semibold">Reminders</h2>
          <p className="mt-2 text-sm text-ink-soft">{checkInDue ? REMINDERS.checkIn.message : "Today’s check-in is complete."}</p>
          {checkInDue && action("checkIn")}
        </section>
      </details>
      {typeof document !== "undefined" && createPortal(
        <div className="pointer-events-none fixed right-3 top-[76px] z-50 w-80 max-w-[calc(100vw-24px)] sm:right-5">
          <div role="status" className="sr-only">{visible && (visible.title + ". " + visible.message)}</div>
          {visible && toast && ToastIcon && (
            <section aria-label={visible.title} className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-line-strong bg-white p-3.5 text-ink shadow-pop">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-tint text-sky"><ToastIcon size={16} aria-hidden /></span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold">{visible.title}</h2>
                <p className="mt-0.5 text-sm text-ink-soft">{visible.message}</p>
                {action(toast)}
              </div>
              <button type="button" onClick={() => setToast(null)} aria-label="Dismiss reminder" className="grid size-7 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-raised"><X size={16} aria-hidden /></button>
            </section>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
