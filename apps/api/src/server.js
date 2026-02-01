/**
 * apps/api/src/server.js (FULL)
 * - เพิ่ม auto_role_enabled/auto_role_id เข้า config
 * - รวม: OAuth2 + Manage Guild + roles list + massrole action
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import session from "express-session";
import fetch from "node-fetch";

import { pool } from "./db.js";
import { guildConfigSchema } from "./validators.js";
import { sendPreviewEmbed } from "./discordPreview.js";

import {
  buildDiscordAuthUrl,
  exchangeCodeForToken,
  fetchDiscordMe,
  fetchDiscordGuilds,
  requireAuth,
  requireManageGuild,
  hasManageGuild,
} from "./auth.js";

const app = express();

app.use(helmet());
app.use(rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false }));
app.use(cors({ origin: process.env.WEB_ORIGIN, credentials: true }));
app.use(express.json({ limit: "1mb" }));

app.use(
  session({
    name: "xerl.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.COOKIE_SECURE === "true",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

function toJsonArray(input) {
  if (input == null) return [];
  if (Array.isArray(input)) return input.map((x) => String(x)).filter(Boolean);
  if (typeof input === "object") return [];

  const s = String(input).trim();
  if (!s) return [];

  if ((s.startsWith("[") && s.endsWith("]")) || (s.startsWith("{") && s.endsWith("}"))) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x)).filter(Boolean);
      return [];
    } catch {}
  }

  if (s.startsWith("{") && s.endsWith("}")) {
    const inner = s.slice(1, -1).trim();
    if (!inner) return [];
    return inner
      .split(",")
      .map((x) => x.trim().replace(/^"+|"+$/g, ""))
      .filter(Boolean);
  }

  return [s];
}

function getDefaultConfig(guildId) {
  return {
    guild_id: guildId,

    welcome_enabled: false,
    welcome_channel_id: null,
    welcome_embed: {},

    leave_enabled: false,
    leave_channel_id: null,
    leave_embed: {},

    alert_enabled: false,
    alert_channel_id: null,
    alert_embed: {},

    // ✅ auto role
    auto_role_enabled: false,
    auto_role_id: null,

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

    updated_at: new Date().toISOString(),
  };
}

async function checkBotInGuild(guildId) {
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) return false;

  const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
    method: "GET",
    headers: { Authorization: `Bot ${botToken}` },
  });

  return res.ok;
}

/* ===== AUTH ===== */
app.get("/auth/discord/login", (req, res) => res.redirect(buildDiscordAuthUrl(req)));

app.get("/auth/discord/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) return res.status(400).send("Missing code/state");
    if (state !== req.session.oauthState) return res.status(400).send("Invalid state");

    const token = await exchangeCodeForToken(String(code));
    const me = await fetchDiscordMe(token.access_token);

    req.session.discord = {
      access_token: token.access_token,
      token_type: token.token_type,
      scope: token.scope,
      user: { id: me.id, username: me.username, global_name: me.global_name, avatar: me.avatar },
      guilds: null,
      guilds_cached_at: 0,
    };

    res.redirect(process.env.WEB_ORIGIN);
  } catch (err) {
    console.error("OAuth callback error:", err);
    res.status(500).send("OAuth callback failed");
  }
});

app.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("xerl.sid");
    res.json({ ok: true });
  });
});

app.get("/api/me", requireAuth, (req, res) => res.json({ user: req.session.discord.user }));

app.get("/api/my-guilds", requireAuth, async (req, res) => {
  try {
    const accessToken = req.session.discord.access_token;
    const guilds = await fetchDiscordGuilds(accessToken);

    const manageable = guilds
      .filter((g) => hasManageGuild(g.permissions))
      .map((g) => ({ id: g.id, name: g.name, icon: g.icon, permissions: g.permissions }));

    const withBotStatus = await Promise.all(
      manageable.map(async (g) => ({ ...g, bot_in_guild: await checkBotInGuild(g.id).catch(() => false) }))
    );

    req.session.discord.guilds = guilds;
    req.session.discord.guilds_cached_at = Date.now();

    res.json({ guilds: withBotStatus });
  } catch (err) {
    console.error("my-guilds error:", err);
    res.status(500).json({ error: "Failed to load guilds" });
  }
});

/* ===== ROLES LIST ===== */
app.get("/api/guilds/:guildId/roles", requireAuth, requireManageGuild, async (req, res) => {
  try {
    const { guildId } = req.params;
    const botToken = process.env.BOT_TOKEN;
    if (!botToken) return res.status(500).json({ error: "BOT_TOKEN missing" });

    const r = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
      headers: { Authorization: `Bot ${botToken}` },
    });

    if (!r.ok) return res.status(500).json({ error: "Failed to fetch roles (bot may not be in guild)" });

    const roles = await r.json();

    const filtered = roles
      .filter((x) => x && x.id && x.name && x.name !== "@everyone")
      .map((x) => ({ id: x.id, name: x.name, position: x.position, managed: x.managed }))
      .sort((a, b) => b.position - a.position);

    res.json({ roles: filtered });
  } catch (err) {
    console.error("roles error:", err);
    res.status(500).json({ error: "Failed to load roles" });
  }
});

/* ===== ACTION massrole ===== */
app.post("/api/guilds/:guildId/actions/massrole", requireAuth, requireManageGuild, async (req, res) => {
  try {
    const { guildId } = req.params;
    const { roleId, mode, userId, includeBots, notifyChannelId } = req.body || {};

    if (!roleId || !mode || !notifyChannelId) return res.status(400).json({ error: "Missing roleId/mode/notifyChannelId" });
    if (mode === "ONE" && !userId) return res.status(400).json({ error: "mode=ONE requires userId" });

    const botUrl = process.env.BOT_INTERNAL_URL;
    const botSecret = process.env.BOT_INTERNAL_SECRET;
    if (!botUrl || !botSecret) return res.status(500).json({ error: "BOT_INTERNAL_URL/SECRET missing" });

    const requestedByUserId = req.session.discord.user.id;

    const rr = await fetch(`${botUrl}/internal/massrole`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": botSecret,
      },
      body: JSON.stringify({
        guildId,
        roleId,
        mode,
        userId,
        includeBots: Boolean(includeBots),
        notifyChannelId,
        requestedByUserId,
      }),
    });

    if (!rr.ok) {
      const text = await rr.text().catch(() => "");
      return res.status(500).json({ error: `Bot internal error: ${rr.status} ${text}` });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("massrole action error:", err);
    res.status(500).json({ error: "Failed to start massrole job" });
  }
});

/* ===== CONFIG ===== */
app.get("/api/guilds/:guildId/config", requireAuth, requireManageGuild, async (req, res) => {
  try {
    const { guildId } = req.params;
    const { rows } = await pool.query("SELECT * FROM guild_configs WHERE guild_id = $1", [guildId]);
    if (!rows[0]) return res.json(getDefaultConfig(guildId));

    const row = rows[0];
    row.antispam_channel_ids = toJsonArray(row.antispam_channel_ids);
    row.antilink_channel_ids = toJsonArray(row.antilink_channel_ids);
    row.antilink_allow_domains = toJsonArray(row.antilink_allow_domains);

    res.json(row);
  } catch (err) {
    console.error("GET config error:", err);
    res.status(500).json({ error: "Failed to load config" });
  }
});

app.put("/api/guilds/:guildId/config", requireAuth, requireManageGuild, async (req, res) => {
  try {
    const { guildId } = req.params;

    const parsed = guildConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    }

    const b = parsed.data;

    const welcomeEmbed = b.welcome_embed ?? {};
    const leaveEmbed = b.leave_embed ?? {};
    const alertEmbed = b.alert_embed ?? {};

    const antispamChannelIds = toJsonArray(b.antispam_channel_ids);
    const antilinkChannelIds = toJsonArray(b.antilink_channel_ids);
    const allowDomains = toJsonArray(b.antilink_allow_domains).map((x) => String(x).toLowerCase());

    const antispamChannelIdsJson = JSON.stringify(antispamChannelIds);
    const antilinkChannelIdsJson = JSON.stringify(antilinkChannelIds);
    const allowDomainsJson = JSON.stringify(allowDomains);

    await pool.query(
      `
      INSERT INTO guild_configs (
        guild_id,

        welcome_enabled, welcome_channel_id, welcome_embed,
        leave_enabled, leave_channel_id, leave_embed,
        alert_enabled, alert_channel_id, alert_embed,

        auto_role_enabled, auto_role_id,

        antispam_enabled, antispam_scope, antispam_channel_ids,
        antispam_window_sec, antispam_max_messages, antispam_action, antispam_timeout_sec,

        antilink_enabled, antilink_scope, antilink_channel_ids,
        antilink_allow_domains, antilink_action, antilink_timeout_sec,

        updated_at
      )
      VALUES (
        $1,

        $2,$3,$4,
        $5,$6,$7,
        $8,$9,$10,

        $11,$12,

        $13,$14,$15::jsonb,
        $16,$17,$18,$19,

        $20,$21,$22::jsonb,
        $23::jsonb,$24,$25,

        NOW()
      )
      ON CONFLICT (guild_id) DO UPDATE SET
        welcome_enabled = EXCLUDED.welcome_enabled,
        welcome_channel_id = EXCLUDED.welcome_channel_id,
        welcome_embed = EXCLUDED.welcome_embed,

        leave_enabled = EXCLUDED.leave_enabled,
        leave_channel_id = EXCLUDED.leave_channel_id,
        leave_embed = EXCLUDED.leave_embed,

        alert_enabled = EXCLUDED.alert_enabled,
        alert_channel_id = EXCLUDED.alert_channel_id,
        alert_embed = EXCLUDED.alert_embed,

        auto_role_enabled = EXCLUDED.auto_role_enabled,
        auto_role_id = EXCLUDED.auto_role_id,

        antispam_enabled = EXCLUDED.antispam_enabled,
        antispam_scope = EXCLUDED.antispam_scope,
        antispam_channel_ids = EXCLUDED.antispam_channel_ids,
        antispam_window_sec = EXCLUDED.antispam_window_sec,
        antispam_max_messages = EXCLUDED.antispam_max_messages,
        antispam_action = EXCLUDED.antispam_action,
        antispam_timeout_sec = EXCLUDED.antispam_timeout_sec,

        antilink_enabled = EXCLUDED.antilink_enabled,
        antilink_scope = EXCLUDED.antilink_scope,
        antilink_channel_ids = EXCLUDED.antilink_channel_ids,
        antilink_allow_domains = EXCLUDED.antilink_allow_domains,
        antilink_action = EXCLUDED.antilink_action,
        antilink_timeout_sec = EXCLUDED.antilink_timeout_sec,

        updated_at = NOW()
      `,
      [
        guildId,

        Boolean(b.welcome_enabled),
        b.welcome_channel_id || null,
        welcomeEmbed,

        Boolean(b.leave_enabled),
        b.leave_channel_id || null,
        leaveEmbed,

        Boolean(b.alert_enabled),
        b.alert_channel_id || null,
        alertEmbed,

        Boolean(b.auto_role_enabled),
        b.auto_role_id || null,

        Boolean(b.antispam_enabled),
        b.antispam_scope || "GUILD",
        antispamChannelIdsJson,
        b.antispam_window_sec ?? 5,
        b.antispam_max_messages ?? 5,
        b.antispam_action || "DELETE",
        b.antispam_timeout_sec ?? 300,

        Boolean(b.antilink_enabled),
        b.antilink_scope || "GUILD",
        antilinkChannelIdsJson,
        allowDomainsJson,
        b.antilink_action || "DELETE",
        b.antilink_timeout_sec ?? 300,
      ]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("PUT config error:", err);
    res.status(500).json({ error: "Failed to save config" });
  }
});

/* ===== PREVIEW (embeds) ===== */
async function loadConfigOrDefault(guildId) {
  const { rows } = await pool.query("SELECT * FROM guild_configs WHERE guild_id = $1", [guildId]);
  return rows[0] || getDefaultConfig(guildId);
}

function buildPreviewCtx(req) {
  const u = req.session.discord.user;
  return { userMention: `<@${u.id}>`, username: u.username || "User", serverName: "Server", memberCount: 123 };
}

app.post("/api/guilds/:guildId/preview/alert", requireAuth, requireManageGuild, async (req, res) => {
  try {
    const { guildId } = req.params;
    const cfg = await loadConfigOrDefault(guildId);
    const channelId = req.body?.channel_id || cfg.alert_channel_id;
    if (!channelId) return res.status(400).json({ error: "Missing channel_id for preview" });
    const embedJson = req.body?.embed || cfg.alert_embed || {};
    await sendPreviewEmbed({ guildId, channelId, embedJson, ctx: buildPreviewCtx(req) });
    res.json({ ok: true });
  } catch (err) {
    console.error("preview alert error:", err);
    res.status(500).json({ error: "Failed to send preview" });
  }
});

app.post("/api/guilds/:guildId/preview/welcome", requireAuth, requireManageGuild, async (req, res) => {
  try {
    const { guildId } = req.params;
    const cfg = await loadConfigOrDefault(guildId);
    const channelId = req.body?.channel_id || cfg.welcome_channel_id;
    if (!channelId) return res.status(400).json({ error: "Missing channel_id for preview" });
    const embedJson = req.body?.embed || cfg.welcome_embed || {};
    await sendPreviewEmbed({ guildId, channelId, embedJson, ctx: buildPreviewCtx(req) });
    res.json({ ok: true });
  } catch (err) {
    console.error("preview welcome error:", err);
    res.status(500).json({ error: "Failed to send preview" });
  }
});

app.post("/api/guilds/:guildId/preview/leave", requireAuth, requireManageGuild, async (req, res) => {
  try {
    const { guildId } = req.params;
    const cfg = await loadConfigOrDefault(guildId);
    const channelId = req.body?.channel_id || cfg.leave_channel_id;
    if (!channelId) return res.status(400).json({ error: "Missing channel_id for preview" });
    const embedJson = req.body?.embed || cfg.leave_embed || {};
    await sendPreviewEmbed({ guildId, channelId, embedJson, ctx: buildPreviewCtx(req) });
    res.json({ ok: true });
  } catch (err) {
    console.error("preview leave error:", err);
    res.status(500).json({ error: "Failed to send preview" });
  }
});

app.get("/health", (req, res) => res.json({ ok: true, service: "xerl-api" }));

const port = Number(process.env.PORT || 3001);
app.listen(port, () => console.log(`✅ Xerl API running on http://localhost:${port}`));
