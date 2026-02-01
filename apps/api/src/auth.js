/**
 * auth.js
 * - Discord OAuth2 login
 * - Session-based auth (httpOnly cookie)
 * - ตรวจสิทธิ์ Manage Guild จาก /users/@me/guilds
 */

import 'dotenv/config';
import fetch from 'node-fetch';

const DISCORD_API = "https://discord.com/api/v10";

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

export function buildDiscordAuthUrl(req) {
  // state กัน CSRF (ผูกกับ session)
  const state = base64url(`${Date.now()}-${Math.random()}`);
  req.session.oauthState = state;

  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: "code",
    scope: "identify guilds",
    state,
    prompt: "none",
  });

  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code) {
  const body = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    client_secret: process.env.DISCORD_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
  });

  const res = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`token exchange failed: ${res.status} ${text}`);
  }

  return res.json(); // { access_token, token_type, expires_in, refresh_token, scope }
}

export async function fetchDiscordMe(accessToken) {
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("failed to fetch /users/@me");
  return res.json();
}

export async function fetchDiscordGuilds(accessToken) {
  const res = await fetch(`${DISCORD_API}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("failed to fetch /users/@me/guilds");
  return res.json();
}

/**
 * Manage Guild permission bit (Discord permission bitfield)
 * - MANAGE_GUILD = 0x20 = 32
 */
export function hasManageGuild(permissions) {
  const perm = Number(permissions);
  return (perm & 0x20) === 0x20;
}

/**
 * middleware: ต้อง login ก่อน
 */
export function requireAuth(req, res, next) {
  if (!req.session?.discord?.access_token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

/**
 * middleware: ต้องมีสิทธิ์ Manage Guild ใน guildId ที่กำลังจะจัดการ
 * - ใช้ cache ใน session ถ้ามี ไม่งั้น fetch ใหม่
 */
export async function requireManageGuild(req, res, next) {
  try {
    const guildId = req.params.guildId;
    const accessToken = req.session.discord.access_token;

    // cache guild list ใน session (ลดเรียก Discord บ่อย)
    const cached = req.session.discord.guilds;
    const cachedAt = req.session.discord.guilds_cached_at || 0;
    const now = Date.now();

    let guilds = cached;
    // refresh ทุก 2 นาที (ปรับได้)
    if (!Array.isArray(guilds) || now - cachedAt > 2 * 60 * 1000) {
      guilds = await fetchDiscordGuilds(accessToken);
      req.session.discord.guilds = guilds;
      req.session.discord.guilds_cached_at = now;
    }

    const g = guilds.find((x) => x.id === guildId);
    if (!g) return res.status(403).json({ error: "Forbidden: not in guild" });

    if (!hasManageGuild(g.permissions)) {
      return res.status(403).json({ error: "Forbidden: missing MANAGE_GUILD" });
    }

    next();
  } catch (err) {
    console.error("requireManageGuild error:", err);
    res.status(500).json({ error: "Permission check failed" });
  }
}
