"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, HandHeart, Lock, MessageSquareText, Send, Star, Users } from "lucide-react";
import type {
  AstronautId,
  AstronautProfile,
  ChallengeStatus,
  CrewLifeBoard,
  CrewMember,
  TitleStanding,
} from "@/types/blue";
import { ApiError, api } from "@/lib/api";
import { openLog } from "@/lib/metrics";
import { useRequireUser } from "@/lib/session";
import {
  ENCOURAGEMENT_PRESETS,
  PATCH_ICONS,
  PERK_ICONS,
  PRESTIGE_TIERS,
  REWARD_KIND_ICONS,
  RITUAL_ICONS,
  crewInitials,
  crewName,
  firstName,
  nextPrestigeTier,
  prestigeBadges,
  prestigeLabel,
  prestigeTier,
} from "@/lib/crewLife";
import AppShell from "@/components/AppShell";
import PageHero from "@/components/PageHero";
import PrestigeBadge from "@/components/PrestigeBadge";
import MissionStarMap from "@/components/MissionStarMap";
import VoicePsychologistFab from "@/components/VoicePsychologistFab";
import { ErrorScreen, FullScreenLoader } from "@/components/ScreenStates";

export default function CrewLifePage() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <CrewLife />
    </Suspense>
  );
}

type Act = (action: () => Promise<CrewLifeBoard>) => Promise<boolean>;

/** Weekly titles, the crew challenge, rewards aboard and the mission map (astronauts only). */
function CrewLife() {
  const params = useSearchParams();
  const { user, error: sessionError, retry, logout } = useRequireUser();
  const [profile, setProfile] = useState<AstronautProfile | null>(null);
  const [board, setBoard] = useState<CrewLifeBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newStarWeek, setNewStarWeek] = useState<number | null>(null);
  const boardRef = useRef<CrewLifeBoard | null>(null);
  const astronautId = user?.role === "astronaut" ? user.astronaut_id : null;
  const arrivedWithStar = params.get("star") === "new";

  const show = useCallback((next: CrewLifeBoard) => {
    const prev = boardRef.current;
    if (prev && !prev.challenge.completed && next.challenge.completed) setNewStarWeek(next.week);
    boardRef.current = next;
    setBoard(next);
  }, []);

  const load = useCallback(() => {
    if (!astronautId) return;
    setError(null);
    Promise.all([api.getAstronaut(astronautId), api.crewLife()])
      .then(([p, b]) => {
        setProfile(p);
        show(b);
        if (arrivedWithStar && b.challenge.completed) setNewStarWeek(b.week);
      })
      .catch(() => setError("Cannot load crew life from the BLUE server."));
  }, [astronautId, arrivedWithStar, show]);

  useEffect(load, [load]);

  const act: Act = useCallback(
    async (action) => {
      setBusy(true);
      setNotice(null);
      try {
        show(await action());
        return true;
      } catch (e) {
        setNotice(e instanceof ApiError ? e.message : "The BLUE server didn't answer. Please try again.");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [show],
  );

  // A check-in filed from this page updates the challenge (and maybe the mission map) right away.
  const handleReportGenerated = useCallback(() => {
    api.crewLife().then(show).catch(() => {});
  }, [show]);

  if (sessionError ?? error) return <ErrorScreen message={(sessionError ?? error)!} onRetry={sessionError ? retry : load} />;
  if (!user) return <FullScreenLoader />;

  if (user.role !== "astronaut") {
    return (
      <AppShell user={user} active="crew-life" onLogout={logout}>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <span className="orb-disc h-12 w-12">
            <Lock className="h-5 w-5" aria-hidden />
          </span>
          <p className="max-w-sm text-sm text-ink-soft">
            Crew life (weekly titles, crew challenge, encouragements) is shared between the astronauts only.
          </p>
          <Link href="/crew" className="btn-soft px-4 py-1.5 text-sm">
            Back to crew
          </Link>
        </div>
      </AppShell>
    );
  }
  if (!profile || !board) return <FullScreenLoader label="Loading crew life…" />;

  return (
    <AppShell user={user} profile={profile} active="crew-life" onLogout={logout} onOpenLog={openLog}>
      <main className="flex w-full flex-col gap-3 pb-28">
        <PageHero
          eyebrow={`Crew life · week ${board.week} · days ${board.week_start_day}–${board.week_end_day}`}
          title="Titles of the week, together"
          texture="wave"
        >
          Light-hearted titles, one crew challenge and small rewards aboard. Only the leaders are named, ties are
          shared, and nobody sees anyone else&apos;s numbers.
        </PageHero>

        {notice && (
          <p role="alert" className="rounded-[16px] border border-advisory-line bg-advisory-soft px-4 py-2.5 text-[13px] text-advisory">
            {notice}
          </p>
        )}

        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,58fr)_minmax(0,42fr)]">
          <div className="flex min-w-0 flex-col gap-3">
            <ChallengeCard board={board} busy={busy} act={act} />
            <TitlesSection board={board} busy={busy} act={act} />
            <PatchesCard board={board} />
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <MissionMapCard board={board} newStarWeek={newStarWeek} />
            <PausesCard board={board} busy={busy} act={act} />
            <EncourageCard board={board} busy={busy} act={act} />
            <PrivacyCard board={board} busy={busy} act={act} />
          </div>
        </div>
      </main>

      <VoicePsychologistFab
        key={profile.id}
        astronautId={profile.id}
        astronautName={profile.name}
        onReportGenerated={handleReportGenerated}
      />
    </AppShell>
  );
}

// --------------------------------------------------------------------------
// Crew challenge
// --------------------------------------------------------------------------

function range(a: number, b: number): number[] {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

function ChallengeCard({ board, busy, act }: { board: CrewLifeBoard; busy: boolean; act: Act }) {
  const c = board.challenge;
  const today = board.mission_day;
  const mine = new Set(c.your_days);
  const yourDone = c.your_days.length >= c.target_days;
  const checkedToday = mine.has(today);

  return (
    <section aria-labelledby="challenge-title" className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Crew challenge · week {c.week}</p>
          <h2 id="challenge-title" className="mt-1 text-[19px] font-medium leading-snug tracking-[-0.02em] text-ink">
            {c.label}
          </h2>
        </div>
        {c.completed ? (
          <span className="pill border-nominal-line bg-nominal-soft text-nominal">
            <Check className="h-3.5 w-3.5" aria-hidden /> Completed
          </span>
        ) : (
          <span className="pill">{c.days_left === 0 ? "Last day of the week" : `${c.days_left} days left`}</span>
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="eyebrow">Your week</p>
          <ol className="mt-2 flex gap-1.5" aria-label="Your check-in days this week">
            {range(c.start_day, c.end_day).map((d) => {
              const done = mine.has(d);
              const future = d > today;
              return (
                <li key={d} className="flex flex-col items-center gap-1">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full border text-[11px] ${
                      done
                        ? "glass-blue border-transparent text-white"
                        : future
                          ? "border-dashed border-line-strong bg-white text-ink-faint"
                          : "border-line-strong bg-raised text-ink-faint"
                    } ${d === today ? "ring-2 ring-sky/30 ring-offset-1" : ""}`}
                  >
                    {done ? <Check className="h-4 w-4" aria-hidden /> : <span aria-hidden>–</span>}
                    <span className="sr-only">
                      Day {d}: {done ? "checked in" : future ? "to come" : "no check-in"}
                    </span>
                  </span>
                  <span className={`num text-[10.5px] ${d === today ? "font-semibold text-sky" : "text-ink-faint"}`}>
                    {d === today ? "Today" : `D${d}`}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="mt-2 text-[13px] text-ink-soft">
            <span className="num font-semibold text-ink">
              {c.your_days.length} of {c.target_days}
            </span>{" "}
            days{yourDone ? ": your part is done." : "."}
          </p>
        </div>

        <div>
          <p className="eyebrow">The crew</p>
          <div className="mt-2 flex items-center gap-1.5" aria-hidden>
            {Array.from({ length: c.crew_size }, (_, i) => (
              <span
                key={i}
                className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                  i < c.crew_on_target ? "border-transparent bg-nominal-soft text-nominal ring-1 ring-inset ring-nominal-line" : "border-dashed border-line-strong bg-white text-ink-faint"
                }`}
              >
                <Users className="h-3.5 w-3.5" />
              </span>
            ))}
          </div>
          <p className="mt-2 text-[13px] text-ink-soft">
            <span className="num font-semibold text-ink">
              {c.crew_on_target} of {c.crew_size}
            </span>{" "}
            crewmates have reached {c.target_days} days. Nobody is named: it&apos;s one challenge for the whole crew.
          </p>
        </div>
      </div>

      {!checkedToday && !c.completed && (
        <button onClick={openLog} className="btn-cta mt-4 py-1.5 pl-5 pr-1.5 text-sm">
          Check in with BLUE today
          <span className="cta-disc">
            <MessageSquareText className="h-3.5 w-3.5" aria-hidden />
          </span>
        </button>
      )}

      <div className="mt-5 border-t border-line pt-4">
        {c.completed ? (
          <RewardVote challenge={c} busy={busy} act={act} />
        ) : (
          <p className="text-[13px] leading-relaxed text-ink-soft">
            <span className="font-semibold text-ink">Shared reward:</span> when everyone gets there, the crew votes
            for a movie night or a special meal, raises the Crew Challenge badge, and a new star joins the mission map.
          </p>
        )}
      </div>
    </section>
  );
}

function RewardVote({ challenge: c, busy, act }: { challenge: ChallengeStatus; busy: boolean; act: Act }) {
  const pick = c.reward_options.find((o) => o.code === c.reward_choice);
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[14px] font-semibold text-ink">Choose the crew reward</p>
        <p className="text-[13px] text-ink-soft">
          {pick ? (
            <>
              Crew pick: <span className="font-semibold text-ink">{pick.label}</span>
            </>
          ) : (
            "No vote yet"
          )}
        </p>
      </div>
      <div role="radiogroup" aria-label="Crew reward" className="mt-3 grid gap-2 sm:grid-cols-2">
        {c.reward_options.map((o) => {
          const Icon = REWARD_KIND_ICONS[o.kind];
          const votes = c.vote_counts[o.code] ?? 0;
          const selected = c.your_vote === o.code;
          return (
            <button
              key={o.code}
              role="radio"
              aria-checked={selected}
              disabled={busy}
              onClick={() => void act(() => api.voteCrewReward(o.code))}
              className={`flex items-center gap-3 rounded-[16px] border px-3.5 py-2.5 text-left text-[13px] transition ${
                selected ? "border-sky bg-tint text-ink" : "border-line bg-white text-ink-soft hover:bg-raised"
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${selected ? "text-sky" : "text-ink-faint"}`} aria-hidden />
              <span className="flex-1">{o.label}</span>
              <span className="num text-[12px] text-ink-faint">
                {votes} vote{votes === 1 ? "" : "s"}
              </span>
              {selected && <Check className="h-4 w-4 text-sky" aria-label="Your vote" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Titles of the week
// --------------------------------------------------------------------------

function TitlesSection({ board, busy, act }: { board: CrewLifeBoard; busy: boolean; act: Act }) {
  return (
    <section aria-labelledby="titles-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-1 pb-2 pt-1">
        <h2 id="titles-title" className="text-[17px] font-medium text-ink">
          Titles of the week
        </h2>
        <p className="text-[12px] text-ink-faint">Leaders only · ties share the title</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {board.titles.map((t) => (
          <TitleCard key={t.code} title={t} board={board} busy={busy} act={act} />
        ))}
      </div>
    </section>
  );
}

function Holder({ crew, id, me }: { crew: CrewMember[]; id: AstronautId; me: AstronautId }) {
  return (
    <span className="pill pl-1">
      <span className="orb-disc num h-5 w-5 text-[9px] font-semibold">{crewInitials(crew, id)}</span>
      {id === me ? "You" : crewName(crew, id)}
    </span>
  );
}

function TitleCard({ title: t, board, busy, act }: { title: TitleStanding; board: CrewLifeBoard; busy: boolean; act: Act }) {
  const Icon = PATCH_ICONS[t.code];
  const PerkIcon = PERK_ICONS[t.perk.code];
  const me = board.astronaut_id;
  return (
    <article className={`card flex flex-col p-4 ${t.you_hold ? "ring-2 ring-inset ring-sky/25" : ""}`}>
      <header className="flex items-center gap-3">
        <span className="orb-disc h-10 w-10">
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className="text-[16px] font-semibold leading-tight text-ink">{t.name}</h3>
        </div>
        {t.you_hold && (
          <span className="pill ml-auto border-transparent bg-tint text-sky">
            <Star className="h-3 w-3" aria-hidden /> You
          </span>
        )}
      </header>
      <p className="mt-2.5 text-[13px] leading-snug text-ink-soft">{t.criterion}</p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {t.holders.length ? (
          <>
            {t.holders.map((id) => (
              <Holder key={id} crew={board.crew} id={id} me={me} />
            ))}
            {t.holders.length > 1 && <span className="text-[12px] text-ink-faint">shared</span>}
          </>
        ) : (
          <span className="text-[13px] text-ink-faint">Up for grabs this week</span>
        )}
      </div>
      <p className="mt-2 text-[12.5px] text-ink-faint">
        You: <span className="num text-ink-soft">{t.your_value}</span>
      </p>

      <div className="mt-3 border-t border-line pt-3">
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
          <PerkIcon className="h-3.5 w-3.5 text-sky" aria-hidden /> {t.perk.label}
        </p>
        {t.you_hold ? (
          <div role="radiogroup" aria-label={t.perk.label} className="mt-2 flex flex-wrap gap-1.5">
            {t.perk.options.map((o) => {
              const selected = t.perk.choice === o;
              return (
                <button
                  key={o}
                  role="radio"
                  aria-checked={selected}
                  disabled={busy}
                  onClick={() => void act(() => api.choosePerk(t.perk.code, o))}
                  className={`rounded-full border px-2.5 py-1 text-[12px] transition ${
                    selected ? "glass-blue border-transparent text-white" : "border-line bg-white text-ink-soft hover:bg-raised"
                  }`}
                >
                  {o}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mt-1 text-[12.5px] text-ink-soft">
            {t.perk.choice ? (
              <>
                Chosen: <span className="font-medium text-ink">{t.perk.choice}</span>
                {t.perk.chosen_by && <> · by {firstName(crewName(board.crew, t.perk.chosen_by))}</>}
              </>
            ) : (
              "The title holder picks it."
            )}
          </p>
        )}
        {t.you_hold && t.perk.choice && t.perk.chosen_by && t.perk.chosen_by !== me && (
          <p className="mt-1.5 text-[12px] text-ink-faint">Picked by {firstName(crewName(board.crew, t.perk.chosen_by))}; you can change it.</p>
        )}
      </div>
    </article>
  );
}

// --------------------------------------------------------------------------
// Mission map
// --------------------------------------------------------------------------

function MissionMapCard({ board, newStarWeek }: { board: CrewLifeBoard; newStarWeek: number | null }) {
  const fresh = newStarWeek === board.week;
  return (
    <section aria-labelledby="map-title" className="card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="map-title" className="text-[17px] font-medium text-ink">
          Mission map
        </h2>
        <p className="num text-[13px] text-ink-soft">
          <span className="text-[20px] font-semibold tracking-[-0.02em] text-ink">{board.stars}</span> stars ·{" "}
          {board.mission_map.length} weeks
        </p>
      </div>
      <p className="mt-1 text-[13px] text-ink-soft">Each crew challenge completed adds a star to the mission map.</p>
      {fresh && (
        <p role="status" className="mt-3 flex items-center gap-2 rounded-[14px] bg-tint px-3 py-2 text-[13px] font-medium text-sky">
          <Star className="h-4 w-4" aria-hidden /> New star for week {board.week}. Well done, crew.
        </p>
      )}
      <div className="mt-3">
        <MissionStarMap weeks={board.mission_map} highlightWeek={newStarWeek} />
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-faint">
        <li className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 20 20" aria-hidden>
            <path d="M10 1.5l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6L1.4 7.8l6-.7z" fill="#0b3d91" />
          </svg>
          Challenge completed
        </li>
        <li className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 20 20" aria-hidden>
            <circle cx="10" cy="10" r="5" fill="#fff" stroke="#9fb3c5" strokeWidth="2.4" />
          </svg>
          Missed
        </li>
        <li className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 20 20" aria-hidden>
            <path d="M10 1.5l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6L1.4 7.8l6-.7z" fill="#fff" stroke="#245bcb" strokeWidth="1.6" />
          </svg>
          This week, in progress
        </li>
      </ul>
    </section>
  );
}

// --------------------------------------------------------------------------
// Pauses & rituals (Keeper of Calm)
// --------------------------------------------------------------------------

function PausesCard({ board, busy, act }: { board: CrewLifeBoard; busy: boolean; act: Act }) {
  const done = new Set(board.rituals_today);
  const full = board.rituals_today.length >= board.max_rituals_per_day;
  return (
    <section aria-labelledby="pauses-title" className="card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="pauses-title" className="text-[17px] font-medium text-ink">
          Take a pause
        </h2>
        <p className="num text-[12.5px] text-ink-faint">
          {board.rituals_today.length} of {board.max_rituals_per_day} today · {board.rituals_week} this week
        </p>
      </div>
      <p className="mt-1 text-[13px] text-ink-soft">
        Validate a pause or a calming ritual once it&apos;s done. Up to {board.max_rituals_per_day} a day count: rest is
        the point, not the score.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {board.ritual_options.map((r) => {
          const Icon = RITUAL_ICONS[r.kind];
          const validated = done.has(r.kind);
          return (
            <button
              key={r.kind}
              disabled={busy || validated || full}
              aria-pressed={validated}
              onClick={() => void act(() => api.validateRitual(r.kind))}
              className={`flex items-center gap-2.5 rounded-[14px] border px-3 py-2.5 text-left text-[13px] transition disabled:cursor-not-allowed ${
                validated ? "border-nominal-line bg-nominal-soft text-nominal" : "border-line bg-white text-ink hover:bg-raised disabled:opacity-55"
              }`}
            >
              {validated ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : <Icon className="h-4 w-4 shrink-0 text-sky" aria-hidden />}
              <span className="min-w-0 flex-1 leading-tight">
                {r.label}
                <span className="num block text-[11px] text-ink-faint">{validated ? "Validated today" : `${r.minutes} min`}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// --------------------------------------------------------------------------
// Encouragements (Crew Compass)
// --------------------------------------------------------------------------

function EncourageCard({ board, busy, act }: { board: CrewLifeBoard; busy: boolean; act: Act }) {
  const mates = board.crew.filter((c) => c.id !== board.astronaut_id);
  const [to, setTo] = useState<AstronautId>(mates[0]?.id ?? board.astronaut_id);
  const [message, setMessage] = useState("");
  const sentToday = board.encouragements_sent.filter((e) => e.mission_day === board.mission_day).length;
  const full = sentToday >= board.max_encouragements_per_day;
  const send = async () => {
    if (!message.trim()) return;
    if (await act(() => api.encourage(to, message.trim()))) setMessage("");
  };

  return (
    <section aria-labelledby="encourage-title" className="card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="encourage-title" className="text-[17px] font-medium text-ink">
          Encourage a crewmate
        </h2>
        <p className="num text-[12.5px] text-ink-faint">
          {sentToday} of {board.max_encouragements_per_day} today
        </p>
      </div>

      <div role="radiogroup" aria-label="Crewmate" className="seg mt-3 w-fit">
        {mates.map((m) => (
          <button key={m.id} role="radio" aria-checked={to === m.id} onClick={() => setTo(m.id)} className="seg-option">
            {firstName(m.name)}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {ENCOURAGEMENT_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setMessage(p)}
            className="rounded-full border border-line bg-white px-2.5 py-1 text-[12px] text-ink-soft transition hover:bg-raised"
          >
            {p}
          </button>
        ))}
      </div>

      <form
        className="mt-3 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">Message to {firstName(crewName(board.crew, to))}</span>
          <textarea
            rows={2}
            maxLength={140}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={`A few words for ${firstName(crewName(board.crew, to))}…`}
            className="field resize-none px-3.5 py-2.5 text-[14px]"
          />
          <span className="num mt-1 block text-right text-[11px] text-ink-faint">{message.length}/140</span>
        </label>
        <button
          type="submit"
          disabled={busy || full || !message.trim()}
          className="btn-cta mb-5 h-10 py-0 pl-4 pr-1 text-[13px]"
        >
          Send
          <span className="cta-disc h-8 w-8">
            <Send className="h-3.5 w-3.5" aria-hidden />
          </span>
        </button>
      </form>
      {full && <p className="text-[12.5px] text-ink-faint">That&apos;s plenty for today. Save the next one for tomorrow.</p>}

      <div className="mt-3 border-t border-line pt-3">
        <p className="eyebrow flex items-center gap-1.5">
          <HandHeart className="h-3.5 w-3.5" aria-hidden /> From the crew this week
        </p>
        {board.encouragements_received.length ? (
          <ul className="thin-scroll mt-2 max-h-56 space-y-2 overflow-y-auto pr-1">
            {board.encouragements_received.map((e) => (
              <li key={e.id} className="rounded-[14px] border border-line bg-raised/70 px-3 py-2">
                <p className="text-[13.5px] leading-snug text-ink">“{e.message}”</p>
                <p className="num mt-1 text-[11.5px] text-ink-faint">
                  {crewName(board.crew, e.from_id)} · D{e.mission_day}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[13px] text-ink-faint">Nothing yet this week.</p>
        )}
      </div>
    </section>
  );
}

// --------------------------------------------------------------------------
// Prestige badges
// --------------------------------------------------------------------------

function PatchesCard({ board }: { board: CrewLifeBoard }) {
  // One emblem per badge kind; its rarity climbs each time it is earned again.
  const badges = prestigeBadges(board.patches);
  return (
    <section aria-labelledby="patches-title" className="card p-5">
      <h2 id="patches-title" className="text-[17px] font-medium text-ink">
        Your prestige badges
      </h2>
      <p className="mt-1 text-[13px] text-ink-soft">
        One emblem per title and one for the crew challenge. Earn it again and its inlaid lines climb to a rarer colour:
        white, blue, purple, red, then yellow. Titles held this week count when the week closes.
      </p>
      {badges.length ? (
        <ul className="mt-4 grid grid-cols-3 gap-x-2 gap-y-5 sm:grid-cols-6">
          {badges.map((b) => {
            const tier = prestigeTier(b.count);
            const next = nextPrestigeTier(b.count);
            return (
              <li key={b.code} className="flex flex-col items-center text-center">
                <PrestigeBadge code={b.code} count={b.count} size={78} label={prestigeLabel(b)} />
                <span className="mt-2 text-[12px] font-medium leading-tight text-ink">{b.name}</span>
                <span className="num text-[11px] font-semibold text-ink-soft">
                  {tier.label} · ×{b.count}
                </span>
                <span className={`num text-[10.5px] ${b.current ? "font-semibold text-sky" : "text-ink-faint"}`}>
                  {b.current ? "Held this week" : next ? `${next.min - b.count} to ${next.label}` : "Top prestige"}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-[13px] text-ink-faint">Your first badge is one title or one crew challenge away.</p>
      )}

      <div className="mt-5 border-t border-line pt-4">
        <p className="eyebrow">Rarity ladder</p>
        <ol className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-3">
          {PRESTIGE_TIERS.map((t) => (
            <li key={t.key} className="flex flex-col items-center">
              <PrestigeBadge code="crew_challenge" count={t.min} size={40} />
              <span className="mt-1 text-[11px] font-medium text-ink-soft">{t.label}</span>
              <span className="num text-[10.5px] text-ink-faint">×{t.min}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// --------------------------------------------------------------------------
// Privacy
// --------------------------------------------------------------------------

function PrivacyCard({ board, busy, act }: { board: CrewLifeBoard; busy: boolean; act: Act }) {
  const on = board.share_in_titles;
  return (
    <section aria-labelledby="privacy-title" className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="privacy-title" className="text-[15px] font-semibold text-ink">
            Show me in the crew titles
          </h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
            When off, your name never appears in the titles. Your check-ins still count for the crew challenge, and you
            still see your own numbers. What you say to BLUE stays private: Voice of the Station only counts messages.
          </p>
        </div>
        <button
          role="switch"
          aria-checked={on}
          aria-labelledby="privacy-title"
          disabled={busy}
          onClick={() => void act(() => api.setShareInTitles(!on))}
          className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full border transition ${
            on ? "glass-blue border-transparent" : "border-line-strong bg-raised"
          }`}
        >
          <span
            className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow transition-[left] ${on ? "left-[24px]" : "left-[3px]"}`}
            aria-hidden
          />
          <span className="sr-only">{on ? "On" : "Off"}</span>
        </button>
      </div>
    </section>
  );
}
