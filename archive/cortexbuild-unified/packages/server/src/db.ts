import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://cortexbuild:cortexbuild123@cortexbuild-postgres:5432/cortexbuild?sslmode=disable";

export const client = postgres(DATABASE_URL, { max: 20 });
export const db = drizzle(client, { schema, logger: process.env.NODE_ENV === "development" });
