import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1, // Reduce for free tier
  connectionTimeoutMillis: 5000, // 5s timeout
  idleTimeoutMillis: 30000,
});

export const db = drizzle(pool, { schema });
export { schema };
