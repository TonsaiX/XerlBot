/**
 * RoleDropdown.jsx (FULL)
 * - dropdown เลือก role แบบ custom (สวย/อ่านชัด) + search
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, Shield } from "lucide-react";

function useOnClickOutside(ref, handler) {
  useEffect(() => {
    function listener(event) {
      if (!ref.current || ref.current.contains(event.target)) return;
      handler();
    }
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler]);
}

export default function RoleDropdown({ label = "Role", value, onChange, roles, disabled, hint }) {
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  useOnClickOutside(wrapRef, () => setOpen(false));

  const selected = useMemo(() => roles.find((r) => r.id === value) || null, [roles, value]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return roles;
    return roles.filter((r) => (r.name || "").toLowerCase().includes(query) || String(r.id).includes(query));
  }, [roles, q]);

  return (
    <div className="space-y-1.5" ref={wrapRef}>
      <div className="text-sm text-zinc-200">{label}</div>

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={[
          "flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm outline-none transition",
          "bg-white/5 text-zinc-100 border-white/10 hover:bg-white/10",
          "focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/10",
          disabled ? "opacity-50 cursor-not-allowed" : "",
        ].join(" ")}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-zinc-300/70" />
            <div className="truncate font-medium">{selected ? selected.name : "— เลือกยศ —"}</div>
          </div>
          {selected ? <div className="mt-0.5 truncate text-[11px] text-zinc-300/70">ID: {selected.id}</div> : null}
        </div>
        <ChevronDown className={open ? "rotate-180 transition" : "transition"} size={18} />
      </button>

      {hint ? <div className="text-xs text-zinc-400">{hint}</div> : null}

      {open ? (
        <div className="relative">
          <div className="absolute left-0 top-full z-50 mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/80 shadow-2xl backdrop-blur-xl">
            <div className="border-b border-white/10 p-3">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <Search size={16} className="text-zinc-300/70" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="ค้นหา role..."
                  className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
                />
              </div>
            </div>

            <div className="max-h-72 overflow-auto p-2">
              {filtered.length === 0 ? (
                <div className="p-3 text-sm text-zinc-300/70">ไม่พบ role</div>
              ) : (
                filtered.map((r) => {
                  const active = r.id === value;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        onChange(r.id);
                        setOpen(false);
                      }}
                      className={[
                        "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition",
                        active ? "bg-indigo-500/15 border border-indigo-400/25" : "hover:bg-white/5",
                      ].join(" ")}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-zinc-100">{r.name}</div>
                        <div className="mt-0.5 truncate text-[11px] text-zinc-300/70">ID: {r.id}</div>
                      </div>
                      {r.managed ? (
                        <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-200">
                          Managed
                        </span>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
