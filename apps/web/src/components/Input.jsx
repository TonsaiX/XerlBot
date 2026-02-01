/**
 * Input.jsx
 * - input style เดียวกันทั้งเว็บ
 */

export default function Input({ label, value, onChange, placeholder, hint }) {
  return (
    <div className="space-y-1.5">
      {label ? <div className="text-sm text-zinc-200">{label}</div> : null}

      <input
        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/10"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />

      {hint ? <div className="text-xs text-zinc-400">{hint}</div> : null}
    </div>
  );
}
