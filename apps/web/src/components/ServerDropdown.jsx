/**
 * ServerDropdown.jsx (FULL)
 * - Dropdown เลือก server แบบ custom (dark glassmorphism)
 * - ✅ เปิดลงด้านล่างแน่นอน
 * - ✅ อ่านชัด/สวย
 * - ✅ มี search
 * - ✅ มี badge "BOT" เด่น ๆ ถ้าบอทอยู่ใน server แล้ว
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, CheckCircle2, CircleOff } from "lucide-react";

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

function BotBadge({ on }) {
  if (on) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/15 px-2 py-0.5 text-[11px] text-emerald-200">
        <CheckCircle2 size={12} />
        BOT
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-zinc-300/80">
      <CircleOff size={12} />
      NO BOT
    </span>
  );
}

export default function ServerDropdown({
  label = "Server",
  value,
  onChange,
  guilds,
  disabled,
  hint,
}) {
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  useOnClickOutside(wrapRef, () => setOpen(false));

  const selected = useMemo(() => {
    return guilds.find((g) => g.id === value) || null;
  }, [guilds, value]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return guilds;

    return guilds.filter((g) => {
      const name = (g.name || "").toLowerCase();
      return name.includes(query) || String(g.id).includes(query);
    });
  }, [guilds, q]);

  return (
    <div className="space-y-1.5" ref={wrapRef}>
      <div className="text-sm text-zinc-200">{label}</div>

      {/* trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={[
          "flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm outline-none transition",
          "bg-white/5 text-zinc-100",
          "border-white/10 hover:bg-white/10",
          "focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/10",
          disabled ? "opacity-50 cursor-not-allowed" : "",
        ].join(" ")}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="truncate font-medium">
              {selected ? selected.name : "— เลือกเซิร์ฟเวอร์ —"}
            </div>
            {selected ? <BotBadge on={Boolean(selected.bot_in_guild)} /> : null}
          </div>
          {selected ? (
            <div className="mt-0.5 truncate text-[11px] text-zinc-300/70">
              ID: {selected.id}
            </div>
          ) : null}
        </div>

        <ChevronDown className={open ? "rotate-180 transition" : "transition"} size={18} />
      </button>

      {hint ? <div className="text-xs text-zinc-400">{hint}</div> : null}

      {/* dropdown panel (เปิดลงล่าง) */}
      {open ? (
        <div className="relative">
          <div className="absolute left-0 top-full z-50 mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/80 shadow-2xl backdrop-blur-xl">
            {/* search */}
            <div className="border-b border-white/10 p-3">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <Search size={16} className="text-zinc-300/70" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="ค้นหา server..."
                  className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
                />
              </div>
            </div>

            {/* list */}
            <div className="max-h-72 overflow-auto p-2">
              {filtered.length === 0 ? (
                <div className="p-3 text-sm text-zinc-300/70">
                  ไม่พบเซิร์ฟเวอร์ที่ค้นหา
                </div>
              ) : (
                filtered.map((g) => {
                  const active = g.id === value;

                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        onChange(g.id);
                        setOpen(false);
                      }}
                      className={[
                        "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition",
                        active ? "bg-indigo-500/15 border border-indigo-400/25" : "hover:bg-white/5",
                      ].join(" ")}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="truncate text-sm font-medium text-zinc-100">
                            {g.name}
                          </div>
                          <BotBadge on={Boolean(g.bot_in_guild)} />
                        </div>
                        <div className="mt-0.5 truncate text-[11px] text-zinc-300/70">
                          ID: {g.id}
                        </div>
                      </div>

                      {active ? (
                        <div className="text-[11px] text-indigo-200/90">Selected</div>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>

            {/* footer tip */}
            <div className="border-t border-white/10 p-3 text-xs text-zinc-300/70">
              ✅ BOT = บอท Xerl อยู่ในเซิร์ฟเวอร์นี้แล้ว • NO BOT = ยังไม่ได้เชิญบอท
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
