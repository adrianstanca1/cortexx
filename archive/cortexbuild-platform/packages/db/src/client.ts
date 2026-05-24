import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL ?? 'postgresql://localhost:5432/cortexbuild';

// Connection pool for queries (keep-alive)
export const queryClient = postgres(connectionString, { prepare: false, max: 10 });

// Connection pool for migrations (prepare enabled)
export const migrationClient = postgres(connectionString, { max: 1 });

export const db = drizzle(queryClient, { schema });
export type Db = typeof db;
