// Integration tests talk to the linked Supabase project, so load .env.local.
import { existsSync } from "node:fs";

if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}
