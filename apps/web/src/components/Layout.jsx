/**
 * Layout.jsx (FULL) — Minimal
 * - ลด gradient/คำอธิบาย
 * - sidebar clean
 */

import { motion } from "framer-motion";
import { Bell, DoorOpen, PartyPopper, Settings, Shield, BadgeCheck } from "lucide-react";

export default function Layout({ active, setActive, title, right, children }) {
  const items = [
    { key: "welcome", label: "Welcome", icon: PartyPopper },
    { key: "leave", label: "Leave", icon: DoorOpen },
    { key: "alert", label: "Alert", icon: Bell },
    { key: "moderation", label: "Moderation", icon: Shield },
    { key: "roles", label: "Roles", icon: BadgeCheck },
    { key: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#0b0d12] text-white">
      <div className="relative mx-auto max-w-7xl px-4 py-8">
        {/* glow ถูกปิดใน css */}
        <div className="glow" />

        <div className="relative grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
          {/* Sidebar */}
          <aside className="glass rounded-2xl p-4">
            <div className="text-lg font-semibold tracking-tight">Xerl</div>
            <div className="mt-6 space-y-1">
              {items.map((it) => {
                const Icon = it.icon;
                const isActive = active === it.key;

                return (
                  <button
                    key={it.key}
                    onClick={() => setActive(it.key)}
                    className={[
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                      "border",
                      isActive
                        ? "bg-white/10 border-white/15"
                        : "bg-transparent border-transparent hover:bg-white/5 hover:border-white/10",
                    ].join(" ")}
                  >
                    <Icon size={16} className="opacity-80" />
                    <span className="truncate">{it.label}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Main */}
          <main className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-base font-semibold">{title}</div>
              </div>
              <div className="flex items-center gap-2">{right}</div>
            </div>

            <motion.div
              className="mt-5"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.14 }}
            >
              {children}
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  );
}
