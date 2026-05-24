import postgres from "postgres";
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://cortexbuild:cortexbuild123@127.0.0.1:5432/cortexbuild?sslmode=disable";
export const sql = postgres(DATABASE_URL, { max: 20, idle_timeout: 20, connect_timeout: 10 });
