/**
 * db.js
 * - รวมการเชื่อมต่อ PostgreSQL ไว้จุดเดียว
 */

import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

/**
 * สร้าง Pool สำหรับ query ฐานข้อมูล
 * - ใช้ DATABASE_URL
 * - รองรับ SSL ด้วย PGSSL=true (เช่นบาง provider)
 */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
});
