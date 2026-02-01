/**
 * Toggle.jsx
 * - สวิตช์เปิด/ปิดแบบเรียบหรู
 */

export default function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 select-none">
      <div className="text-sm text-zinc-200">{label}</div>

      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={[
          "relative h-7 w-12 rounded-full border transition",
          checked
            ? "border-emerald-400/40 bg-emerald-500/20"
            : "border-white/10 bg-white/5",
        ].join(" ")}
        aria-pressed={checked}
      >
        <span
          className={[
            "absolute top-1 h-5 w-5 rounded-full transition",
            checked ? "left-6 bg-emerald-300" : "left-1 bg-zinc-200",
          ].join(" ")}
        />
      </button>
    </label>
  );
}
