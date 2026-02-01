/**
 * EmbedPreview.jsx
 * - preview แบบในเว็บ (ไม่เหมือน Discord 100% แต่ช่วยดู layout)
 * - ตัวจริงให้กดปุ่ม Preview เพื่อยิงเข้า Discord (เหมือนจริงสุด)
 */

function applyVars(text = "") {
  // preview ในเว็บ: เราใส่ค่าตัวอย่าง
  const ctx = {
    user: "@You",
    username: "You",
    server: "Xerl Server",
    memberCount: "123",
  };

  return String(text)
    .replaceAll("{user}", ctx.user)
    .replaceAll("{username}", ctx.username)
    .replaceAll("{server}", ctx.server)
    .replaceAll("{memberCount}", ctx.memberCount);
}

export default function EmbedPreview({ embed }) {
  const e = embed || {};
  const fields = Array.isArray(e.fields) ? e.fields : [];

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="text-xs text-zinc-400">Preview (web mock)</div>

      <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-4">
        {e.title ? <div className="text-base font-semibold">{applyVars(e.title)}</div> : null}

        {e.description ? (
          <div className="mt-2 whitespace-pre-wrap text-sm text-zinc-200">
            {applyVars(e.description)}
          </div>
        ) : null}

        {fields.length > 0 ? (
          <div className="mt-3 space-y-2">
            {fields.map((f, idx) => (
              <div key={idx} className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="text-sm font-semibold">{applyVars(f?.name ?? "")}</div>
                <div className="mt-1 whitespace-pre-wrap text-sm text-zinc-200">
                  {applyVars(f?.value ?? "")}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {e.footer ? <div className="mt-3 text-xs text-zinc-400">{applyVars(e.footer)}</div> : null}
      </div>

      <div className="mt-3 text-xs text-zinc-500">
        * ถ้าต้องการเหมือน Discord 100% ให้กดปุ่ม Preview (ส่งเข้า Discord)
      </div>
    </div>
  );
}
