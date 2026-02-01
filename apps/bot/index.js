/**
 * apps/bot/index.js (FULL) — MODERATION WORKING
 *
 * รวมครบ:
 * - Welcome / Leave
 * - ✅ Auto Role on Join
 * - /alert
 * - /massrole + progress + done notify
 * - ✅ Internal API: /internal/massrole
 * - ✅ Moderation: Anti-Spam (Flood) + Anti-Link
 *
 * ต้องเปิด Intents ใน Discord Developer Portal:
 * - Server Members Intent
 * - Message Content Intent  ✅ สำคัญ
 */

import "dotenv/config";
import express from "express";
import pg from "pg";
import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionsBitField,
} from "discord.js";

const { Pool } = pg;

/**
 * ===== DB =====
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
});

async function getGuildConfig(guildId) {
  const { rows } = await pool.query("SELECT * FROM guild_configs WHERE guild_id = $1", [guildId]);
  return rows[0] || null;
}

/**
 * ===== Discord Client =====
 * ✅ ต้องมี GuildMessages + MessageContent ไม่งั้นอ่านข้อความไม่ได้
 */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,

    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

/**
 * ===== Embed helpers =====
 */
function applyVars(text = "", ctx) {
  return String(text)
    .replaceAll("{user}", ctx.userMention)
    .replaceAll("{username}", ctx.username)
    .replaceAll("{server}", ctx.serverName)
    .replaceAll("{memberCount}", String(ctx.memberCount));
}

function buildEmbed(embedJson = {}, ctx) {
  const e = new EmbedBuilder();

  if (embedJson.title) e.setTitle(applyVars(embedJson.title, ctx));
  if (embedJson.description) e.setDescription(applyVars(embedJson.description, ctx));
  if (typeof embedJson.color === "number") e.setColor(embedJson.color);

  if (embedJson.thumbnailUrl) e.setThumbnail(embedJson.thumbnailUrl);
  if (embedJson.imageUrl) e.setImage(embedJson.imageUrl);

  if (embedJson.footer) e.setFooter({ text: applyVars(embedJson.footer, ctx) });

  if (Array.isArray(embedJson.fields)) {
    for (const f of embedJson.fields.slice(0, 25)) {
      e.addFields({
        name: applyVars(String(f?.name ?? ""), ctx).slice(0, 256),
        value: applyVars(String(f?.value ?? ""), ctx).slice(0, 1024),
        inline: Boolean(f?.inline),
      });
    }
  }

  return e;
}

/**
 * ===== Slash Commands =====
 */
async function registerCommands() {
  const alertCmd = new SlashCommandBuilder()
    .setName("alert")
    .setDescription("ส่ง alert embed ไปช่องที่ตั้งค่าไว้");

  const massRoleCmd = new SlashCommandBuilder()
    .setName("massrole")
    .setDescription("เพิ่มยศให้คนเดียวหรือทุกคน พร้อม progress")
    .addRoleOption((opt) => opt.setName("role").setDescription("ยศที่จะเพิ่ม").setRequired(true))
    .addStringOption((opt) =>
      opt
        .setName("mode")
        .setDescription("เพิ่มยศให้ใคร")
        .setRequired(true)
        .addChoices(
          { name: "ALL (ทุกคน)", value: "ALL" },
          { name: "ONE (คนเดียว)", value: "ONE" }
        )
    )
    .addUserOption((opt) => opt.setName("user").setDescription("เลือกคน (ใช้เมื่อ mode=ONE)").setRequired(false))
    .addBooleanOption((opt) =>
      opt.setName("include_bots").setDescription("รวมบอทด้วยไหม (ตอน ALL)").setRequired(false)
    );

  const commands = [alertCmd.toJSON(), massRoleCmd.toJSON()];

  const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN);
  const appId = process.env.APPLICATION_ID;

  if (!appId) {
    console.log("⚠️ ยังไม่มี APPLICATION_ID ใน .env — ข้าม register slash commands");
    return;
  }

  await rest.put(Routes.applicationCommands(appId), { body: commands });
  console.log("✅ Registered slash commands");
}

/**
 * ===== Moderation Utils =====
 */

function inScope(scope, channelIds, channelId) {
  if (scope === "GUILD") return true;
  if (scope === "CHANNELS") return Array.isArray(channelIds) && channelIds.includes(channelId);
  return false;
}

function hasUrl(text) {
  const urlRegex = /(https?:\/\/[^\s]+)|((www\.)[^\s]+)/gi;
  return urlRegex.test(text || "");
}

function extractDomains(text) {
  const matches = (text || "").match(/https?:\/\/[^\s]+/gi) || [];
  const domains = [];

  for (const u of matches) {
    try {
      const parsed = new URL(u);
      domains.push((parsed.hostname || "").toLowerCase());
    } catch {}
  }

  const matchesWww = (text || "").match(/www\.[^\s]+/gi) || [];
  for (const w of matchesWww) {
    const cleaned = w.replace(/^www\./i, "").split("/")[0];
    if (cleaned) domains.push(cleaned.toLowerCase());
  }

  return domains;
}

function domainAllowed(domain, allowDomains) {
  const list = (allowDomains || []).map((x) => String(x).toLowerCase());
  if (list.length === 0) return false;
  return list.some((allow) => domain === allow || domain.endsWith("." + allow));
}

async function takeAction({ action, timeoutSec, message, member, reason }) {
  // WARN
  if (action === "WARN") {
    try {
      await message.reply({ content: `⚠️ ${reason}` });
    } catch {}
    return;
  }

  // DELETE
  if (action === "DELETE") {
    try {
      if (message.deletable) await message.delete();
    } catch {}
    return;
  }

  // TIMEOUT
  if (action === "TIMEOUT") {
    try {
      if (message.deletable) await message.delete();
    } catch {}

    try {
      if (member && member.moderatable) {
        await member.timeout(timeoutSec * 1000, reason);
      }
    } catch {}
    return;
  }
}

/**
 * ===== Anti-Spam State =====
 * key: `${guildId}:${userId}` -> timestamps(ms)[]
 */
const spamBuckets = new Map();

function pushAndCount(bucketKey, nowMs, windowMs) {
  const arr = spamBuckets.get(bucketKey) || [];
  const filtered = arr.filter((t) => nowMs - t <= windowMs);
  filtered.push(nowMs);
  spamBuckets.set(bucketKey, filtered);
  return filtered.length;
}

// cleanup
setInterval(() => {
  const now = Date.now();
  for (const [k, arr] of spamBuckets.entries()) {
    const filtered = arr.filter((t) => now - t <= 60_000);
    if (filtered.length === 0) spamBuckets.delete(k);
    else spamBuckets.set(k, filtered);
  }
}, 60_000);

/**
 * ===== Mass Role Assign =====
 */
function makeProgressBar(done, total, width = 20) {
  const ratio = total <= 0 ? 0 : Math.min(1, done / total);
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  return `[\`${"█".repeat(filled)}${"░".repeat(empty)}\`] ${Math.round(ratio * 100)}% (${done}/${total})`;
}

async function sendOrEditProgress({ channel, messageRef, content }) {
  if (!messageRef.current) {
    messageRef.current = await channel.send(content);
    return;
  }
  try {
    await messageRef.current.edit(content);
  } catch {
    messageRef.current = await channel.send(content);
  }
}

async function runMassRoleJob({
  guildId,
  roleId,
  mode,
  userId,
  includeBots,
  notifyChannelId,
  requestedByUserId,
}) {
  const guild = await client.guilds.fetch(guildId);
  const channel = await guild.channels.fetch(notifyChannelId).catch(() => null);

  if (!channel || !channel.isTextBased()) {
    throw new Error("Notify channel is not text-based or not found");
  }

  const me = await guild.members.fetchMe();
  if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    await channel.send("❌ บอทไม่มีสิทธิ์ Manage Roles");
    return;
  }

  const role = await guild.roles.fetch(roleId).catch(() => null);
  if (!role) {
    await channel.send("❌ หา Role ไม่เจอ");
    return;
  }

  if (role.position >= me.roles.highest.position) {
    await channel.send("❌ Role ของบอทต้องสูงกว่า Role ที่จะเพิ่ม (โปรดขยับ role บอทขึ้น)");
    return;
  }

  let targets = [];
  if (mode === "ONE") {
    if (!userId) {
      await channel.send("❌ mode=ONE ต้องระบุ userId");
      return;
    }
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) {
      await channel.send("❌ ไม่พบสมาชิกคนนี้ในเซิร์ฟเวอร์");
      return;
    }
    targets = [member];
  } else {
    const members = await guild.members.fetch();
    targets = [...members.values()].filter((m) => (includeBots ? true : !m.user.bot));
  }

  targets = targets.filter((m) => !m.roles.cache.has(roleId));
  const total = targets.length;

  const messageRef = { current: null };
  const startEmbed = new EmbedBuilder()
    .setTitle("🧩 Xerl • Mass Role Assign")
    .setDescription(`กำลังเพิ่มยศ <@&${roleId}>...\nผู้สั่ง: <@${requestedByUserId || "unknown"}>`)
    .setColor(0x6366f1);

  await sendOrEditProgress({ channel, messageRef, content: { embeds: [startEmbed] } });

  let done = 0;
  let success = 0;
  let failed = 0;

  const UPDATE_EVERY = 10;

  for (const member of targets) {
    try {
      if (!member.manageable) {
        failed++;
      } else {
        await member.roles.add(roleId, `Xerl massrole by ${requestedByUserId || "unknown"}`);
        success++;
      }
    } catch {
      failed++;
    }

    done++;

    if (done === 1 || done % UPDATE_EVERY === 0 || done === total) {
      const bar = makeProgressBar(done, total, 22);
      const embed = new EmbedBuilder()
        .setTitle("🧩 Xerl • Mass Role Assign")
        .setColor(0x22c55e)
        .setDescription(
          `Role: <@&${roleId}>\nMode: ${mode}\n${bar}\n\n✅ สำเร็จ: **${success}**\n❌ ล้มเหลว/ข้าม: **${failed}**`
        )
        .setFooter({ text: "กำลังทำงาน..." });

      await sendOrEditProgress({ channel, messageRef, content: { embeds: [embed] } });
    }

    await new Promise((r) => setTimeout(r, 250));
  }

  const doneEmbed = new EmbedBuilder()
    .setTitle("✅ Xerl • Mass Role Assign เสร็จแล้ว")
    .setColor(0x10b981)
    .setDescription(
      `Role: <@&${roleId}>\nทำเสร็จทั้งหมด: **${done}** คน\n\n✅ สำเร็จ: **${success}**\n❌ ล้มเหลว/ข้าม: **${failed}**\n\nผู้สั่ง: <@${requestedByUserId || "unknown"}>`
    )
    .setFooter({ text: "Done" });

  await sendOrEditProgress({ channel, messageRef, content: { embeds: [doneEmbed] } });
  await channel.send(`🎉 เสร็จแล้ว! เพิ่มยศ <@&${roleId}> ให้ **${success}** คน`);
}

/**
 * ===== Internal API for bot =====
 */
const internalApp = express();
internalApp.use(express.json({ limit: "1mb" }));

internalApp.post("/internal/massrole", async (req, res) => {
  try {
    const secret = req.headers["x-internal-secret"];
    if (!secret || secret !== process.env.BOT_INTERNAL_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const {
      guildId,
      roleId,
      mode,
      userId,
      includeBots,
      notifyChannelId,
      requestedByUserId,
    } = req.body || {};

    if (!guildId || !roleId || !mode || !notifyChannelId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    runMassRoleJob({
      guildId,
      roleId,
      mode,
      userId,
      includeBots: Boolean(includeBots),
      notifyChannelId,
      requestedByUserId,
    }).catch((e) => console.error("runMassRoleJob error:", e));

    return res.json({ ok: true });
  } catch (err) {
    console.error("internal/massrole error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
});

/**
 * ===== Ready =====
 */
client.on("ready", async () => {
  console.log(`✅ Xerl logged in as ${client.user.tag}`);

  await registerCommands().catch((err) => console.error("registerCommands error:", err));

  // start internal server
  const port = Number(process.env.BOT_INTERNAL_PORT || 3002);
  internalApp.listen(port, () => {
    console.log(`✅ Xerl Bot Internal API running on http://localhost:${port}`);
  });
});

/**
 * ===== Auto Role + Welcome =====
 */
client.on("guildMemberAdd", async (member) => {
  try {
    const cfg = await getGuildConfig(member.guild.id);

    // ✅ Auto role on join
    if (cfg?.auto_role_enabled && cfg?.auto_role_id) {
      try {
        const me = await member.guild.members.fetchMe();
        const role = await member.guild.roles.fetch(cfg.auto_role_id).catch(() => null);

        if (role && me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
          if (role.position < me.roles.highest.position && member.manageable) {
            if (!member.roles.cache.has(role.id)) {
              await member.roles.add(role.id, "Xerl auto role on join");
            }
          }
        }
      } catch (e) {
        console.error("auto role error:", e);
      }
    }

    // Welcome message
    if (!cfg?.welcome_enabled) return;
    if (!cfg.welcome_channel_id) return;

    const channel = await member.guild.channels.fetch(cfg.welcome_channel_id).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const ctx = {
      userMention: `<@${member.user.id}>`,
      username: member.user.username,
      serverName: member.guild.name,
      memberCount: member.guild.memberCount,
    };

    const embed = buildEmbed(cfg.welcome_embed || {}, ctx);
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("guildMemberAdd error:", err);
  }
});

/**
 * ===== Leave message =====
 */
client.on("guildMemberRemove", async (member) => {
  try {
    const cfg = await getGuildConfig(member.guild.id);
    if (!cfg?.leave_enabled) return;
    if (!cfg.leave_channel_id) return;

    const channel = await member.guild.channels.fetch(cfg.leave_channel_id).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const ctx = {
      userMention: `<@${member.user.id}>`,
      username: member.user.username,
      serverName: member.guild.name,
      memberCount: member.guild.memberCount,
    };

    const embed = buildEmbed(cfg.leave_embed || {}, ctx);
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("guildMemberRemove error:", err);
  }
});

/**
 * ===== /alert + /massrole =====
 */
client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "alert") {
      const cfg = await getGuildConfig(interaction.guildId);

      if (!cfg?.alert_enabled) {
        await interaction.reply({ content: "ยังไม่ได้เปิดระบบ Alert ในเซิร์ฟเวอร์นี้", ephemeral: true });
        return;
      }
      if (!cfg.alert_channel_id) {
        await interaction.reply({ content: "ยังไม่ได้ตั้งค่า Alert Channel", ephemeral: true });
        return;
      }

      const channel = await interaction.guild.channels.fetch(cfg.alert_channel_id).catch(() => null);
      if (!channel || !channel.isTextBased()) {
        await interaction.reply({ content: "ช่อง Alert ที่ตั้งไว้ใช้งานไม่ได้", ephemeral: true });
        return;
      }

      const ctx = {
        userMention: `<@${interaction.user.id}>`,
        username: interaction.user.username,
        serverName: interaction.guild.name,
        memberCount: interaction.guild.memberCount,
      };

      const embed = buildEmbed(cfg.alert_embed || {}, ctx);
      await channel.send({ embeds: [embed] });

      await interaction.reply({ content: "ส่ง Alert แล้ว ✅", ephemeral: true });
      return;
    }

    if (interaction.commandName === "massrole") {
      if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageRoles)) {
        await interaction.reply({ content: "❌ ต้องมีสิทธิ์ Manage Roles", ephemeral: true });
        return;
      }

      const role = interaction.options.getRole("role", true);
      const mode = interaction.options.getString("mode", true);
      const user = interaction.options.getUser("user", false);
      const includeBots = interaction.options.getBoolean("include_bots", false) || false;

      if (mode === "ONE" && !user) {
        await interaction.reply({ content: "❌ mode=ONE ต้องเลือก user ด้วย", ephemeral: true });
        return;
      }

      await interaction.reply({ content: "เริ่มทำงานแล้ว ✅ (ดู progress ในห้องนี้)", ephemeral: true });

      runMassRoleJob({
        guildId: interaction.guildId,
        roleId: role.id,
        mode,
        userId: user?.id,
        includeBots,
        notifyChannelId: interaction.channelId,
        requestedByUserId: interaction.user.id,
      }).catch((e) => console.error("massrole cmd error:", e));

      return;
    }
  } catch (err) {
    console.error("interactionCreate error:", err);
    if (interaction.isRepliable()) {
      await interaction.reply({ content: "เกิดข้อผิดพลาด", ephemeral: true }).catch(() => {});
    }
  }
});

/**
 * ✅ ===== Moderation: messageCreate =====
 * - Anti-Link: ตรวจลิ้ง -> delete/timeout/warn
 * - Anti-Spam: ตรวจฟลัด -> delete/timeout/warn
 */
client.on("messageCreate", async (message) => {
  try {
    // ignore DMs/system/bots
    if (!message.guild) return;
    if (!message.member) return;
    if (message.author?.bot) return;

    // ignore admin
    if (message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

    const cfg = await getGuildConfig(message.guild.id);
    if (!cfg) return;

    // ===== Anti-Link =====
    if (cfg.antilink_enabled) {
      const scopeOk = inScope(cfg.antilink_scope, cfg.antilink_channel_ids, message.channelId);

      if (scopeOk) {
        const content = message.content || "";
        if (hasUrl(content)) {
          const domains = extractDomains(content);
          const allowDomains = cfg.antilink_allow_domains || [];

          // ถ้ามีโดเมนที่ไม่ได้อยู่ใน allow -> ถือว่าผิด
          const hasBad = domains.some((d) => !domainAllowed(d, allowDomains));

          if (hasBad) {
            await takeAction({
              action: cfg.antilink_action || "DELETE",
              timeoutSec: Number(cfg.antilink_timeout_sec || 300),
              message,
              member: message.member,
              reason: "ห้ามส่งลิ้งก์ในห้องนี้",
            });
            return;
          }
        }
      }
    }

    // ===== Anti-Spam (Flood) =====
    if (cfg.antispam_enabled) {
      const scopeOk = inScope(cfg.antispam_scope, cfg.antispam_channel_ids, message.channelId);

      if (scopeOk) {
        const windowSec = Number(cfg.antispam_window_sec || 5);
        const maxMsg = Number(cfg.antispam_max_messages || 5);

        const now = Date.now();
        const key = `${message.guild.id}:${message.author.id}`;
        const count = pushAndCount(key, now, windowSec * 1000);

        if (count > maxMsg) {
          await takeAction({
            action: cfg.antispam_action || "DELETE",
            timeoutSec: Number(cfg.antispam_timeout_sec || 300),
            message,
            member: message.member,
            reason: `ส่งข้อความถี่เกินไป (${maxMsg}/${windowSec}s)`,
          });
          return;
        }
      }
    }
  } catch (err) {
    console.error("messageCreate moderation error:", err);
  }
});

client.login(process.env.BOT_TOKEN);