/**
 * GlassCard.jsx
 * - การ์ดสไตล์ glassmorphism (dark)
 */

export default function GlassCard({ title, subtitle, children, right }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-xl backdrop-blur-xl">
      {/* แสง glow เบา ๆ */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl" />

      <div className="flex items-start justify-between gap-4 p-5">
        <div>
          <div className="text-lg font-semibold">{title}</div>
          {subtitle ? <div className="mt-1 text-sm text-zinc-300/80">{subtitle}</div> : null}
        </div>
        {right ? <div>{right}</div> : null}
      </div>

      <div className="px-5 pb-5">{children}</div>
    </div>
  );
}
