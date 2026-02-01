/**
 * validators.js (FULL)
 * - ตรวจรูปแบบข้อมูล config จากเว็บก่อนเขียนลง DB
 */

import { z } from "zod";

/**
 * schema ของ field ใน embed
 * - Discord จำกัด: fields <= 25
 */
const embedFieldSchema = z.object({
  name: z.string().max(256),
  value: z.string().max(1024),
  inline: z.boolean().optional().default(false),
});

/**
 * schema ของ embed config
 */
export const embedSchema = z.object({
  title: z.string().max(256).optional(),
  description: z.string().max(4000).optional(),
  color: z.number().int().min(0).max(0xffffff).optional(),
  thumbnailUrl: z.string().url().optional().or(z.literal("")),
  imageUrl: z.string().url().optional().or(z.literal("")),
  footer: z.string().max(2048).optional(),
  fields: z.array(embedFieldSchema).max(25).optional(),
});

/**
 * Moderation schemas
 */
const scopeSchema = z.enum(["GUILD", "CHANNELS"]); // ทั้งเซิร์ฟเวอร์ หรือเฉพาะห้องที่เลือก
const actionSchema = z.enum(["DELETE", "TIMEOUT", "WARN"]); // ทำอะไรเมื่อผิดกฎ
const idListSchema = z.array(z.string()).max(200); // list ของ channel IDs

export const guildConfigSchema = z.object({
  welcome_enabled: z.boolean().optional(),
  welcome_channel_id: z.string().optional().nullable(),
  welcome_embed: embedSchema.optional(),

  alert_enabled: z.boolean().optional(),
  alert_channel_id: z.string().optional().nullable(),
  alert_embed: embedSchema.optional(),

  leave_enabled: z.boolean().optional(),
  leave_channel_id: z.string().optional().nullable(),
  leave_embed: embedSchema.optional(),

  // ✅ Auto role on join
  auto_role_enabled: z.boolean().optional(),
  auto_role_id: z.string().optional().nullable(),

  // ===== Anti-Spam (Flood) =====
  antispam_enabled: z.boolean().optional(),
  antispam_scope: scopeSchema.optional(),
  antispam_channel_ids: idListSchema.optional(),
  antispam_window_sec: z.number().int().min(2).max(60).optional(),
  antispam_max_messages: z.number().int().min(2).max(30).optional(),
  antispam_action: actionSchema.optional(),
  antispam_timeout_sec: z.number().int().min(10).max(3600).optional(),

  // ===== Anti-Link =====
  antilink_enabled: z.boolean().optional(),
  antilink_scope: scopeSchema.optional(),
  antilink_channel_ids: idListSchema.optional(),
  antilink_allow_domains: z.array(z.string().min(1).max(200)).max(200).optional(),
  antilink_action: actionSchema.optional(),
  antilink_timeout_sec: z.number().int().min(10).max(3600).optional(),
});
