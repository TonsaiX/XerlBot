/**
 * apps/web/src/lib/api.js (FULL)
 * - เพิ่ม:
 *   ✅ fetchGuildRoles(guildId)
 *   ✅ startMassRole(guildId, payload)
 */

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

async function handleJson(res) {
  if (!res.ok) {
    let detail = "";
    try {
      const data = await res.json();
      detail = data?.error ? `: ${data.error}` : "";
    } catch {}
    throw new Error(`API error ${res.status}${detail}`);
  }
  return res.json();
}

export async function fetchMe() {
  const res = await fetch(`${API_BASE}/api/me`, { credentials: "include" });
  return handleJson(res);
}

export async function fetchMyGuilds() {
  const res = await fetch(`${API_BASE}/api/my-guilds`, { credentials: "include" });
  return handleJson(res);
}

export async function fetchGuildConfig(guildId) {
  const res = await fetch(`${API_BASE}/api/guilds/${guildId}/config`, {
    method: "GET",
    credentials: "include",
  });
  return handleJson(res);
}

export async function saveGuildConfig(guildId, payload) {
  const res = await fetch(`${API_BASE}/api/guilds/${guildId}/config`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleJson(res);
}

export async function previewWelcome(guildId, body = {}) {
  const res = await fetch(`${API_BASE}/api/guilds/${guildId}/preview/welcome`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleJson(res);
}

export async function previewLeave(guildId, body = {}) {
  const res = await fetch(`${API_BASE}/api/guilds/${guildId}/preview/leave`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleJson(res);
}

export async function previewAlert(guildId, body = {}) {
  const res = await fetch(`${API_BASE}/api/guilds/${guildId}/preview/alert`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleJson(res);
}

/** ✅ NEW: roles */
export async function fetchGuildRoles(guildId) {
  const res = await fetch(`${API_BASE}/api/guilds/${guildId}/roles`, {
    method: "GET",
    credentials: "include",
  });
  return handleJson(res); // { roles: [...] }
}

/** ✅ NEW: start mass role job */
export async function startMassRole(guildId, body) {
  const res = await fetch(`${API_BASE}/api/guilds/${guildId}/actions/massrole`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleJson(res);
}
