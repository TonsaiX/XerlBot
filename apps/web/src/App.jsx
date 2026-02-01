/**
 * App.jsx (FULL) — Minimal UI
 * - ลดคำอธิบายให้เหลือเท่าที่จำเป็น
 * - ตัดกล่องทิป/คำแนะนำยาว ๆ
 */

import { useEffect, useMemo, useState } from "react";

import Layout from "./components/Layout.jsx";
import Button from "./components/Button.jsx";
import Input from "./components/Input.jsx";
import Toggle from "./components/Toggle.jsx";
import EmbedEditor from "./components/EmbedEditor.jsx";
import EmbedPreview from "./components/EmbedPreview.jsx";
import ServerDropdown from "./components/ServerDropdown.jsx";
import RoleDropdown from "./components/RoleDropdown.jsx";

import {
  fetchMe,
  fetchMyGuilds,
  fetchGuildConfig,
  saveGuildConfig,
  previewWelcome,
  previewLeave,
  previewAlert,
  fetchGuildRoles,
  startMassRole,
} from "./lib/api.js";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

function makeDefaultConfig(guildId) {
  return {
    guild_id: guildId,

    welcome_enabled: false,
    welcome_channel_id: "",
    welcome_embed: {},

    leave_enabled: false,
    leave_channel_id: "",
    leave_embed: {},

    alert_enabled: false,
    alert_channel_id: "",
    alert_embed: {},

    auto_role_enabled: false,
    auto_role_id: "",

    antispam_enabled: false,
    antispam_scope: "GUILD",
    antispam_channel_ids: [],
    antispam_window_sec: 5,
    antispam_max_messages: 5,
    antispam_action: "DELETE",
    antispam_timeout_sec: 300,

    antilink_enabled: false,
    antilink_scope: "GUILD",
    antilink_channel_ids: [],
    antilink_allow_domains: [],
    antilink_action: "DELETE",
    antilink_timeout_sec: 300,
  };
}

function normalizeConfig(raw, guildId) {
  const c = raw || {};
  return {
    guild_id: c.guild_id || guildId,

    welcome_enabled: Boolean(c.welcome_enabled),
    welcome_channel_id: c.welcome_channel_id ?? "",
    welcome_embed: c.welcome_embed ?? {},

    leave_enabled: Boolean(c.leave_enabled),
    leave_channel_id: c.leave_channel_id ?? "",
    leave_embed: c.leave_embed ?? {},

    alert_enabled: Boolean(c.alert_enabled),
    alert_channel_id: c.alert_channel_id ?? "",
    alert_embed: c.alert_embed ?? {},

    auto_role_enabled: Boolean(c.auto_role_enabled),
    auto_role_id: c.auto_role_id ?? "",

    antispam_enabled: Boolean(c.antispam_enabled),
    antispam_scope: c.antispam_scope ?? "GUILD",
    antispam_channel_ids: Array.isArray(c.antispam_channel_ids) ? c.antispam_channel_ids : [],
    antispam_window_sec: Number(c.antispam_window_sec ?? 5),
    antispam_max_messages: Number(c.antispam_max_messages ?? 5),
    antispam_action: c.antispam_action ?? "DELETE",
    antispam_timeout_sec: Number(c.antispam_timeout_sec ?? 300),

    antilink_enabled: Boolean(c.antilink_enabled),
    antilink_scope: c.antilink_scope ?? "GUILD",
    antilink_channel_ids: Array.isArray(c.antilink_channel_ids) ? c.antilink_channel_ids : [],
    antilink_allow_domains: Array.isArray(c.antilink_allow_domains) ? c.antilink_allow_domains : [],
    antilink_action: c.antilink_action ?? "DELETE",
    antilink_timeout_sec: Number(c.antilink_timeout_sec ?? 300),
  };
}

function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-5 right-5 z-50">
      <div className="glass rounded-xl px-4 py-2 text-sm text-white">{message}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm font-semibold text-white/90">{title}</div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function parseIdsCsv(text) {
  return String(text || "")
    .split(",")
    .map((x) => x.trim())
    .filter((x) => /^[0-9]{10,30}$/.test(x));
}

function parseDomainsCsv(text) {
  return String(text || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
    .map((d) => d.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0])
    .filter(Boolean);
}

export default function App() {
  const [active, setActive] = useState("settings");

  const [authLoading, setAuthLoading] = useState(true);
  const [me, setMe] = useState(null);
  const isAuthed = Boolean(me?.user?.id);

  const [guilds, setGuilds] = useState([]);
  const [guildsLoading, setGuildsLoading] = useState(false);
  const [selectedGuildId, setSelectedGuildId] = useState("");

  const [cfg, setCfg] = useState(null);

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  // moderation inputs
  const [antispamChannelsCsv, setAntispamChannelsCsv] = useState("");
  const [antilinkChannelsCsv, setAntilinkChannelsCsv] = useState("");
  const [antilinkDomainsCsv, setAntilinkDomainsCsv] = useState("");

  // roles
  const [rolesLoading, setRolesLoading] = useState(false);
  const [roles, setRoles] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [massMode, setMassMode] = useState("ALL");
  const [targetUserId, setTargetUserId] = useState("");
  const [includeBots, setIncludeBots] = useState(false);
  const [notifyChannelId, setNotifyChannelId] = useState("");

  const showToast = (msg) => {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(""), 2000);
  };

  const pageTitle = useMemo(() => {
    if (active === "welcome") return "Welcome";
    if (active === "leave") return "Leave";
    if (active === "alert") return "Alert";
    if (active === "moderation") return "Moderation";
    if (active === "roles") return "Roles";
    return "Settings";
  }, [active]);

  const effectiveGuildId = useMemo(() => selectedGuildId.trim(), [selectedGuildId]);
  const canLoad = useMemo(() => effectiveGuildId.length > 0, [effectiveGuildId]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setAuthLoading(true);
      try {
        const data = await fetchMe();
        if (cancelled) return;
        setMe(data);
      } catch {
        if (!cancelled) setMe(null);
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!isAuthed) return;

      setGuildsLoading(true);
      try {
        const data = await fetchMyGuilds();
        if (cancelled) return;

        const list = Array.isArray(data?.guilds) ? data.guilds : [];
        setGuilds(list);

        if (list.length > 0 && !selectedGuildId) setSelectedGuildId(list[0].id);
      } catch (err) {
        console.error(err);
        if (!cancelled) showToast(err?.message || "Load guilds failed");
      } finally {
        if (!cancelled) setGuildsLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  function onLogin() {
    window.location.href = `${API_BASE}/auth/discord/login`;
  }

  async function onLogout() {
    try {
      await fetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "include" });
    } catch {}
    setMe(null);
    setGuilds([]);
    setSelectedGuildId("");
    setCfg(null);
    setRoles([]);
    setSelectedRoleId("");
    setActive("settings");
    showToast("Logged out");
  }

  async function onLoad() {
    if (!canLoad) return;

    setBusy(true);
    try {
      const id = effectiveGuildId;
      const data = await fetchGuildConfig(id);

      const normalized = normalizeConfig(data, id);
      const hasAny = data && (data.welcome_embed || data.leave_embed || data.alert_embed);

      const finalCfg = hasAny ? normalized : makeDefaultConfig(id);
      setCfg(finalCfg);

      setAntispamChannelsCsv((finalCfg.antispam_channel_ids || []).join(", "));
      setAntilinkChannelsCsv((finalCfg.antilink_channel_ids || []).join(", "));
      setAntilinkDomainsCsv((finalCfg.antilink_allow_domains || []).join(", "));

      setNotifyChannelId(finalCfg.alert_channel_id || finalCfg.welcome_channel_id || "");

      showToast("Loaded");
    } catch (err) {
      console.error(err);
      showToast(err?.message || "Load failed");
    } finally {
      setBusy(false);
    }
  }

  async function onSave() {
    if (!cfg?.guild_id) return;

    const antispamIds = cfg.antispam_scope === "CHANNELS" ? parseIdsCsv(antispamChannelsCsv) : [];
    const antilinkIds = cfg.antilink_scope === "CHANNELS" ? parseIdsCsv(antilinkChannelsCsv) : [];
    const allowDomains = parseDomainsCsv(antilinkDomainsCsv);

    const payload = {
      welcome_enabled: cfg.welcome_enabled,
      welcome_channel_id: cfg.welcome_channel_id || null,
      welcome_embed: cfg.welcome_embed || {},

      leave_enabled: cfg.leave_enabled,
      leave_channel_id: cfg.leave_channel_id || null,
      leave_embed: cfg.leave_embed || {},

      alert_enabled: cfg.alert_enabled,
      alert_channel_id: cfg.alert_channel_id || null,
      alert_embed: cfg.alert_embed || {},

      auto_role_enabled: cfg.auto_role_enabled,
      auto_role_id: cfg.auto_role_id || null,

      antispam_enabled: cfg.antispam_enabled,
      antispam_scope: cfg.antispam_scope,
      antispam_channel_ids: antispamIds,
      antispam_window_sec: Number(cfg.antispam_window_sec || 5),
      antispam_max_messages: Number(cfg.antispam_max_messages || 5),
      antispam_action: cfg.antispam_action,
      antispam_timeout_sec: Number(cfg.antispam_timeout_sec || 300),

      antilink_enabled: cfg.antilink_enabled,
      antilink_scope: cfg.antilink_scope,
      antilink_channel_ids: antilinkIds,
      antilink_allow_domains: allowDomains,
      antilink_action: cfg.antilink_action,
      antilink_timeout_sec: Number(cfg.antilink_timeout_sec || 300),
    };

    setBusy(true);
    try {
      await saveGuildConfig(cfg.guild_id, payload);
      setCfg({
        ...cfg,
        antispam_channel_ids: antispamIds,
        antilink_channel_ids: antilinkIds,
        antilink_allow_domains: allowDomains,
      });
      showToast("Saved");
    } catch (err) {
      console.error(err);
      showToast(err?.message || "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function onPreviewWelcome() {
    if (!cfg?.guild_id) return;
    setBusy(true);
    try {
      await previewWelcome(cfg.guild_id, { channel_id: cfg.welcome_channel_id || undefined, embed: cfg.welcome_embed || {} });
      showToast("Sent");
    } catch (err) {
      console.error(err);
      showToast("Failed");
    } finally {
      setBusy(false);
    }
  }

  async function onPreviewLeave() {
    if (!cfg?.guild_id) return;
    setBusy(true);
    try {
      await previewLeave(cfg.guild_id, { channel_id: cfg.leave_channel_id || undefined, embed: cfg.leave_embed || {} });
      showToast("Sent");
    } catch (err) {
      console.error(err);
      showToast("Failed");
    } finally {
      setBusy(false);
    }
  }

  async function onPreviewAlert() {
    if (!cfg?.guild_id) return;
    setBusy(true);
    try {
      await previewAlert(cfg.guild_id, { channel_id: cfg.alert_channel_id || undefined, embed: cfg.alert_embed || {} });
      showToast("Sent");
    } catch (err) {
      console.error(err);
      showToast("Failed");
    } finally {
      setBusy(false);
    }
  }

  async function loadRoles() {
    if (!cfg?.guild_id) return;
    setRolesLoading(true);
    try {
      const data = await fetchGuildRoles(cfg.guild_id);
      const list = Array.isArray(data?.roles) ? data.roles : [];
      setRoles(list);
      if (!selectedRoleId) {
        const first = list.find((r) => !r.managed) || list[0];
        if (first) setSelectedRoleId(first.id);
      }
      showToast("Roles loaded");
    } catch (err) {
      console.error(err);
      showToast("Roles failed");
    } finally {
      setRolesLoading(false);
    }
  }

  async function onStartMassRole() {
    if (!cfg?.guild_id || !selectedRoleId) return;
    if (!notifyChannelId || !/^[0-9]{10,30}$/.test(notifyChannelId)) return;
    if (massMode === "ONE" && !/^[0-9]{10,30}$/.test(targetUserId)) return;

    setBusy(true);
    try {
      await startMassRole(cfg.guild_id, {
        roleId: selectedRoleId,
        mode: massMode,
        userId: massMode === "ONE" ? targetUserId : undefined,
        includeBots,
        notifyChannelId,
      });
      showToast("Started");
    } catch (err) {
      console.error(err);
      showToast("Failed");
    } finally {
      setBusy(false);
    }
  }

  const topRight = (
    <div className="flex items-center gap-2">
      <Button variant="secondary" disabled={!canLoad || busy} onClick={onLoad}>
        Load
      </Button>
      <Button variant="primary" disabled={!cfg || busy} onClick={onSave}>
        Save
      </Button>

      {authLoading ? null : isAuthed ? (
        <div className="flex items-center gap-2">
          <div className="text-xs text-white/60">{me?.user?.global_name || me?.user?.username}</div>
          <Button variant="secondary" onClick={onLogout} disabled={busy}>
            Logout
          </Button>
        </div>
      ) : (
        <Button variant="primary" onClick={onLogin} disabled={busy}>
          Login
        </Button>
      )}
    </div>
  );

  return (
    <>
      <Layout active={active} setActive={setActive} title={pageTitle} right={topRight}>
        {/* SETTINGS */}
        {active === "settings" ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Section title="Server">
              {isAuthed ? (
                <ServerDropdown
                  label="Server"
                  value={selectedGuildId}
                  onChange={(v) => {
                    setSelectedGuildId(v);
                    setCfg(null);
                    setRoles([]);
                    setSelectedRoleId("");
                  }}
                  guilds={guilds}
                  disabled={guildsLoading || busy}
                />
              ) : (
                <div className="text-sm text-white/70">Login required</div>
              )}
            </Section>

            <Section title="Account">
              {isAuthed ? (
                <div className="text-sm text-white/70">Logged in</div>
              ) : (
                <div className="text-sm text-white/70">Not logged in</div>
              )}
            </Section>
          </div>
        ) : null}

        {/* WELCOME */}
        {active === "welcome" && cfg ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.25fr_.75fr]">
            <Section title="Welcome">
              <div className="space-y-4">
                <Toggle label="Enabled" checked={cfg.welcome_enabled} onChange={(v) => setCfg({ ...cfg, welcome_enabled: v })} />
                <Input label="Channel ID" value={cfg.welcome_channel_id} onChange={(v) => setCfg({ ...cfg, welcome_channel_id: v })} />
                <EmbedEditor value={cfg.welcome_embed} onChange={(v) => setCfg({ ...cfg, welcome_embed: v })} />
              </div>
            </Section>
            <Section title="Preview">
              <div className="space-y-3">
                <Button variant="secondary" disabled={busy} onClick={onPreviewWelcome}>
                  Preview
                </Button>
                <EmbedPreview embed={cfg.welcome_embed} />
              </div>
            </Section>
          </div>
        ) : null}

        {/* LEAVE */}
        {active === "leave" && cfg ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.25fr_.75fr]">
            <Section title="Leave">
              <div className="space-y-4">
                <Toggle label="Enabled" checked={cfg.leave_enabled} onChange={(v) => setCfg({ ...cfg, leave_enabled: v })} />
                <Input label="Channel ID" value={cfg.leave_channel_id} onChange={(v) => setCfg({ ...cfg, leave_channel_id: v })} />
                <EmbedEditor value={cfg.leave_embed} onChange={(v) => setCfg({ ...cfg, leave_embed: v })} />
              </div>
            </Section>
            <Section title="Preview">
              <div className="space-y-3">
                <Button variant="secondary" disabled={busy} onClick={onPreviewLeave}>
                  Preview
                </Button>
                <EmbedPreview embed={cfg.leave_embed} />
              </div>
            </Section>
          </div>
        ) : null}

        {/* ALERT */}
        {active === "alert" && cfg ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.25fr_.75fr]">
            <Section title="Alert">
              <div className="space-y-4">
                <Toggle label="Enabled" checked={cfg.alert_enabled} onChange={(v) => setCfg({ ...cfg, alert_enabled: v })} />
                <Input label="Channel ID" value={cfg.alert_channel_id} onChange={(v) => setCfg({ ...cfg, alert_channel_id: v })} />
                <EmbedEditor value={cfg.alert_embed} onChange={(v) => setCfg({ ...cfg, alert_embed: v })} />
              </div>
            </Section>
            <Section title="Preview">
              <div className="space-y-3">
                <Button variant="secondary" disabled={busy} onClick={onPreviewAlert}>
                  Preview
                </Button>
                <EmbedPreview embed={cfg.alert_embed} />
              </div>
            </Section>
          </div>
        ) : null}

        {/* MODERATION */}
        {active === "moderation" && cfg ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Section title="Anti-Spam">
              <div className="space-y-4">
                <Toggle label="Enabled" checked={cfg.antispam_enabled} onChange={(v) => setCfg({ ...cfg, antispam_enabled: v })} />
                <div className="flex gap-2">
                  <Button variant={cfg.antispam_scope === "GUILD" ? "primary" : "secondary"} onClick={() => setCfg({ ...cfg, antispam_scope: "GUILD" })}>
                    ทุกช่อง
                  </Button>
                  <Button variant={cfg.antispam_scope === "CHANNELS" ? "primary" : "secondary"} onClick={() => setCfg({ ...cfg, antispam_scope: "CHANNELS" })}>
                    เลือกช่อง
                  </Button>
                </div>
                {cfg.antispam_scope === "CHANNELS" ? (
                  <Input label="Channel IDs" value={antispamChannelsCsv} onChange={setAntispamChannelsCsv} placeholder="id,id,id" />
                ) : null}
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Window (sec)" value={String(cfg.antispam_window_sec)} onChange={(v) => setCfg({ ...cfg, antispam_window_sec: Number(v || 5) })} />
                  <Input label="Max msgs" value={String(cfg.antispam_max_messages)} onChange={(v) => setCfg({ ...cfg, antispam_max_messages: Number(v || 5) })} />
                </div>
                <Input label="Action" value={cfg.antispam_action} onChange={(v) => setCfg({ ...cfg, antispam_action: v })} placeholder="DELETE" />
                {cfg.antispam_action === "TIMEOUT" ? (
                  <Input label="Timeout sec" value={String(cfg.antispam_timeout_sec)} onChange={(v) => setCfg({ ...cfg, antispam_timeout_sec: Number(v || 300) })} />
                ) : null}
              </div>
            </Section>

            <Section title="Anti-Link">
              <div className="space-y-4">
                <Toggle label="Enabled" checked={cfg.antilink_enabled} onChange={(v) => setCfg({ ...cfg, antilink_enabled: v })} />
                <div className="flex gap-2">
                  <Button variant={cfg.antilink_scope === "GUILD" ? "primary" : "secondary"} onClick={() => setCfg({ ...cfg, antilink_scope: "GUILD" })}>
                    ทุกช่อง
                  </Button>
                  <Button variant={cfg.antilink_scope === "CHANNELS" ? "primary" : "secondary"} onClick={() => setCfg({ ...cfg, antilink_scope: "CHANNELS" })}>
                    เลือกช่อง
                  </Button>
                </div>
                {cfg.antilink_scope === "CHANNELS" ? (
                  <Input label="Channel IDs" value={antilinkChannelsCsv} onChange={setAntilinkChannelsCsv} placeholder="id,id,id" />
                ) : null}
                <Input label="Allow domains" value={antilinkDomainsCsv} onChange={setAntilinkDomainsCsv} placeholder="youtube.com,discord.com" />
                <Input label="Action" value={cfg.antilink_action} onChange={(v) => setCfg({ ...cfg, antilink_action: v })} placeholder="DELETE" />
                {cfg.antilink_action === "TIMEOUT" ? (
                  <Input label="Timeout sec" value={String(cfg.antilink_timeout_sec)} onChange={(v) => setCfg({ ...cfg, antilink_timeout_sec: Number(v || 300) })} />
                ) : null}
              </div>
            </Section>
          </div>
        ) : null}

        {/* ROLES */}
        {active === "roles" && cfg ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Section title="Auto Role">
              <div className="space-y-4">
                <Button variant="secondary" disabled={rolesLoading || busy} onClick={loadRoles}>
                  {rolesLoading ? "Loading..." : "Load Roles"}
                </Button>
                <Toggle label="Enabled" checked={cfg.auto_role_enabled} onChange={(v) => setCfg({ ...cfg, auto_role_enabled: v })} />
                <RoleDropdown
                  label="Role"
                  value={cfg.auto_role_id || ""}
                  onChange={(v) => setCfg({ ...cfg, auto_role_id: v })}
                  roles={roles}
                  disabled={rolesLoading || busy || !cfg.auto_role_enabled}
                />
              </div>
            </Section>

            <Section title="Mass Role">
              <div className="space-y-4">
                <Button variant="secondary" disabled={rolesLoading || busy} onClick={loadRoles}>
                  {rolesLoading ? "Loading..." : "Load Roles"}
                </Button>
                <RoleDropdown label="Role" value={selectedRoleId} onChange={setSelectedRoleId} roles={roles} disabled={rolesLoading || busy} />
                <div className="flex gap-2">
                  <Button variant={massMode === "ALL" ? "primary" : "secondary"} onClick={() => setMassMode("ALL")} disabled={busy}>
                    ALL
                  </Button>
                  <Button variant={massMode === "ONE" ? "primary" : "secondary"} onClick={() => setMassMode("ONE")} disabled={busy}>
                    ONE
                  </Button>
                </div>
                {massMode === "ONE" ? <Input label="User ID" value={targetUserId} onChange={setTargetUserId} /> : null}
                <Toggle label="Include bots" checked={includeBots} onChange={setIncludeBots} />
                <Input label="Notify channel ID" value={notifyChannelId} onChange={setNotifyChannelId} />
                <Button variant="primary" disabled={busy} onClick={onStartMassRole}>
                  Start
                </Button>
              </div>
            </Section>
          </div>
        ) : null}

        {/* fallback */}
        {active !== "settings" && !cfg ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/80">
            Load config in Settings
          </div>
        ) : null}
      </Layout>

      <Toast message={toast} />
    </>
  );
}
