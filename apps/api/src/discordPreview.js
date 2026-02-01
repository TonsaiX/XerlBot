/**
 * discordPreview.js
 * - ใช้ BOT_TOKEN ส่ง embed preview ไปช่อง Discord
 * - เหมาะสำหรับ preview แบบเหมือนจริง 100%
 */

import 'dotenv/config';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';

let clientPromise = null;

/**
 * สร้าง client แบบ singleton
 * - ไม่สร้างใหม่ทุก request (ประหยัด resource)
 */
async function getClient() {
  if (clientPromise) return clientPromise;

  clientPromise = (async () => {
    const c = new Client({
      intents: [GatewayIntentBits.Guilds],
    });

    await c.login(process.env.BOT_TOKEN);
    return c;
  })();

  return clientPromise;
}

/**
 * แทนค่า variables ในข้อความ embed
 */
function applyVars(text = '', ctx) {
  return String(text)
    .replaceAll('{user}', ctx.userMention)
    .replaceAll('{username}', ctx.username)
    .replaceAll('{server}', ctx.serverName)
    .replaceAll('{memberCount}', String(ctx.memberCount));
}

/**
 * แปลง JSON -> EmbedBuilder
 */
function buildEmbed(embedJson = {}, ctx) {
  const e = new EmbedBuilder();

  if (embedJson.title) e.setTitle(applyVars(embedJson.title, ctx));
  if (embedJson.description) e.setDescription(applyVars(embedJson.description, ctx));
  if (typeof embedJson.color === 'number') e.setColor(embedJson.color);

  if (embedJson.thumbnailUrl) e.setThumbnail(embedJson.thumbnailUrl);
  if (embedJson.imageUrl) e.setImage(embedJson.imageUrl);

  if (embedJson.footer) e.setFooter({ text: applyVars(embedJson.footer, ctx) });

  if (Array.isArray(embedJson.fields)) {
    for (const f of embedJson.fields.slice(0, 25)) {
      e.addFields({
        name: applyVars(String(f.name || ''), ctx).slice(0, 256),
        value: applyVars(String(f.value || ''), ctx).slice(0, 1024),
        inline: Boolean(f.inline),
      });
    }
  }

  return e;
}

/**
 * ส่ง embed preview ไปช่องที่กำหนด
 */
export async function sendPreviewEmbed({ guildId, channelId, embedJson, ctx }) {
  const c = await getClient();

  // fetch guild
  const guild = await c.guilds.fetch(guildId);

  // fetch channel
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    throw new Error('Preview channel is not text-based or not found');
  }

  const embed = buildEmbed(embedJson, ctx);

  await channel.send({ embeds: [embed] });
}
