/**
 * Button.jsx
 * - ปุ่มหลัก/รอง
 */

export default function Button({ variant = "primary", children, ...props }) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-white/10 disabled:opacity-50 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "bg-indigo-500/80 hover:bg-indigo-500 text-white"
      : variant === "danger"
      ? "bg-rose-500/70 hover:bg-rose-500 text-white"
      : "border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-100";

  return (
    <button className={`${base} ${styles}`} {...props}>
      {children}
    </button>
  );
}
