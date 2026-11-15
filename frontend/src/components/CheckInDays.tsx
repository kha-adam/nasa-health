import { Check } from "lucide-react";
import type { CrewLifeBoard } from "@/types/blue";

export default function CheckInDays({ board }: {
  board: Pick<CrewLifeBoard, "challenge" | "mission_day">;
}) {
  const { start_day, end_day, your_days } = board.challenge;
  const completed = new Set(your_days);
  return (
    <ol className="mt-2 flex gap-1.5" aria-label="Your check-in days this week">
      {Array.from({ length: end_day - start_day + 1 }, (_, index) => {
        const day = start_day + index;
        const done = completed.has(day);
        const future = day > board.mission_day;
        const today = day === board.mission_day;
        return (
          <li key={day} aria-current={today ? "date" : undefined} className="flex flex-col items-center gap-0.5">
            <span className={`flex items-center justify-center rounded-full border text-[11px] h-8 w-8 ${
              done ? "border-[#0a6259] bg-[#11796d] text-white"
                : future ? "border-dashed border-line-strong bg-white text-ink-faint"
                : "border-line-strong bg-raised text-ink-faint"
            } ${today ? "ring-1 ring-[#11796d] ring-offset-1" : ""}`}>
              {done ? <Check className="h-4 w-4" aria-hidden /> : <span aria-hidden>–</span>}
              <span className="sr-only">Day {day}: {done ? "checked in" : future ? "upcoming" : "no check-in"}</span>
            </span>
            <span aria-hidden className={`num text-[10.5px] ${today ? "font-semibold text-[#0a6259]" : "text-ink-faint"}`}>
              {today ? "Today" : `D${day}`}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
