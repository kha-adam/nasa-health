/**
 * Compact decorative page header (SphereAI-style envelope with a fluid blue texture).
 * Presentation only: it renders the page's existing eyebrow, title and description.
 * The texture sits on the right; the text keeps a solid cobalt background for contrast.
 */
export default function PageHero({
  eyebrow,
  title,
  children,
  texture = "glacier",
}: {
  eyebrow: string;
  title: React.ReactNode;
  children?: React.ReactNode;
  texture?: "glacier" | "wave";
}) {
  const image = texture === "wave" ? "url('/brand/fluid-wave.webp')" : "url('/brand/glacier-texture.webp')";
  return (
    <header
      className="envelope px-6 py-6 text-white shadow-[0_14px_32px_-18px_rgb(17_63_150/0.6)] sm:px-8 sm:py-7"
      style={{
        backgroundImage: `linear-gradient(100deg, #1f4fb3 0%, rgb(36 91 203 / 0.92) 38%, rgb(36 91 203 / 0.3) 70%, rgb(36 91 203 / 0) 100%), ${image}`,
        backgroundPosition: "center, right center",
        backgroundSize: "cover, cover",
      }}
    >
      <p className="inline-flex rounded-full border border-white/35 bg-white/15 px-3 py-1 text-[12px] font-medium text-white">
        {eyebrow}
      </p>
      <h1 className="mt-3 max-w-2xl text-[28px] font-light leading-tight tracking-[-0.03em] sm:text-[34px]">{title}</h1>
      {children && <div className="mt-2 max-w-2xl text-[14px] leading-relaxed text-white/90">{children}</div>}
    </header>
  );
}
