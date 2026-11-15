/**
 * Compact page header in blue liquid glass (the material of the login panel and
 * the mission bar, see --glass-blue-bg in globals.css).
 * Presentation only: it renders the page's existing eyebrow, title and description.
 */
export default function PageHero({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  children?: React.ReactNode;
  /** Kept for existing callers; the glass material replaces the old textures. */
  texture?: "glacier" | "wave";
}) {
  return (
    <header className="glass-blue relative overflow-hidden rounded-[28px] px-6 py-6 text-white sm:px-8 sm:py-7">
      <p className="inline-flex rounded-full border border-white/35 bg-white/15 px-3 py-1 text-[12px] font-medium text-white">
        {eyebrow}
      </p>
      <h1 className="mt-3 max-w-2xl text-[28px] font-light leading-tight tracking-[-0.03em] sm:text-[34px]">{title}</h1>
      {children && <div className="mt-2 max-w-2xl text-[14px] leading-relaxed text-white/90">{children}</div>}
    </header>
  );
}
