/**
 * EmbedEditor.jsx
 * - ฟอร์มแก้ embed JSON แบบเป็นมิตร
 * - รองรับ title/description/color/footer/thumbnailUrl/imageUrl/fields
 */

import Input from "./Input.jsx";
import TextArea from "./TextArea.jsx";
import Button from "./Button.jsx";

function toIntOrEmpty(v) {
  // แปลงให้เป็น int ถ้าเป็นตัวเลข ไม่งั้นให้เป็น ""
  if (v === "" || v === null || v === undefined) return "";
  const n = Number(v);
  return Number.isFinite(n) ? n : "";
}

export default function EmbedEditor({ value, onChange }) {
  const embed = value || {};

  // helper อัปเดต field เดียว
  const update = (patch) => {
    onChange({ ...embed, ...patch });
  };

  // helper อัปเดต fields
  const updateFields = (fields) => {
    update({ fields });
  };

  const fields = Array.isArray(embed.fields) ? embed.fields : [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          label="Title"
          value={embed.title ?? ""}
          onChange={(v) => update({ title: v })}
          placeholder="เช่น Welcome to {server}!"
          hint="รองรับตัวแปร {user} {username} {server} {memberCount}"
        />

        <Input
          label="Color (0 - 16777215)"
          value={toIntOrEmpty(embed.color)}
          onChange={(v) => update({ color: v === "" ? undefined : Number(v) })}
          placeholder="เช่น 5793266"
          hint="เป็นเลขฐาน 10 (decimal) เช่น 5793266"
        />
      </div>

      <TextArea
        label="Description"
        value={embed.description ?? ""}
        onChange={(v) => update({ description: v })}
        placeholder="เช่น ยินดีต้อนรับ {user} 🎉"
        rows={4}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          label="Thumbnail URL"
          value={embed.thumbnailUrl ?? ""}
          onChange={(v) => update({ thumbnailUrl: v })}
          placeholder="https://..."
        />
        <Input
          label="Image URL"
          value={embed.imageUrl ?? ""}
          onChange={(v) => update({ imageUrl: v })}
          placeholder="https://..."
        />
      </div>

      <Input
        label="Footer"
        value={embed.footer ?? ""}
        onChange={(v) => update({ footer: v })}
        placeholder="เช่น Xerl • Welcome System"
      />

      {/* Fields */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Fields</div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              if (fields.length >= 25) return;
              updateFields([...fields, { name: "Field name", value: "Field value", inline: false }]);
            }}
          >
            + เพิ่ม Field
          </Button>
        </div>

        {fields.length === 0 ? (
          <div className="mt-3 text-sm text-zinc-400">ยังไม่มี fields</div>
        ) : (
          <div className="mt-4 space-y-3">
            {fields.map((f, idx) => (
              <div key={idx} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Input
                    label={`Field #${idx + 1} Name`}
                    value={f?.name ?? ""}
                    onChange={(v) => {
                      const copy = [...fields];
                      copy[idx] = { ...copy[idx], name: v };
                      updateFields(copy);
                    }}
                  />
                  <Input
                    label="Inline (true/false)"
                    value={String(Boolean(f?.inline))}
                    onChange={(v) => {
                      const copy = [...fields];
                      copy[idx] = { ...copy[idx], inline: v === "true" };
                      updateFields(copy);
                    }}
                    placeholder="true หรือ false"
                  />
                </div>

                <div className="mt-3">
                  <TextArea
                    label="Value"
                    value={f?.value ?? ""}
                    onChange={(v) => {
                      const copy = [...fields];
                      copy[idx] = { ...copy[idx], value: v };
                      updateFields(copy);
                    }}
                    rows={3}
                  />
                </div>

                <div className="mt-3 flex justify-end">
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => {
                      const copy = fields.filter((_, i) => i !== idx);
                      updateFields(copy);
                    }}
                  >
                    ลบ Field
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ช่วยจำ */}
      <div className="text-xs text-zinc-400">
        ตัวแปรที่ใช้ได้: <span className="text-zinc-200">{`{user}`}</span>,{" "}
        <span className="text-zinc-200">{`{username}`}</span>,{" "}
        <span className="text-zinc-200">{`{server}`}</span>,{" "}
        <span className="text-zinc-200">{`{memberCount}`}</span>
      </div>
    </div>
  );
}
