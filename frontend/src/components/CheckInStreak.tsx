import { Flame } from "lucide-react";

export default function CheckInStreak({ days }: { days: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#ecd6b0] bg-[#fff6e6] px-2.5 py-1.5 text-xs font-semibold text-[#825015]">
      <Flame size={15} aria-hidden />
      <span className="num">{days} {days === 1 ? "day" : "days"}</span>
      <span className="sr-only">check-in streak</span>
    </span>
  );
}
