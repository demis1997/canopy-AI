import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export function migrationDatabaseUrl(env) {
  const value = env.DIRECT_URL?.trim() || env.DATABASE_URL?.trim();
  if (!value) throw new Error("Set DIRECT_URL or DATABASE_URL before applying migrations");
  const url = new URL(value);
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error("Migrations require a PostgreSQL URL");
  // A Neon endpoint has direct and pooled addresses for the same database.
  if (url.hostname.endsWith(".neon.tech")) {
    if (!env.DIRECT_URL?.trim()) url.hostname = url.hostname.replace(/-pooler(?=\.)/, "");
    const timeout = Number(url.searchParams.get("connect_timeout"));
    if (!Number.isFinite(timeout) || timeout < 30) url.searchParams.set("connect_timeout", "30");
  }
  return url.toString();
}

export async function migrate(env, execute, wait, report = () => {}) {
  const databaseUrl = migrationDatabaseUrl(env);
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = execute({ ...env, DATABASE_URL: databaseUrl });
    if (result.status === 0) return 0;
    if (result.error || !/\bP1001\b/.test(result.stderr ?? "") || attempt === 2)
      return result.status || 1;
    report("Database unreachable (P1001); retrying migration connection…");
    await wait(2000 * (attempt + 1));
  }
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const envFile = fileURLToPath(new URL("../.env", import.meta.url));
    if (existsSync(envFile)) process.loadEnvFile(envFile);
    process.exitCode = await migrate(
      process.env,
      (env) => {
        const result = spawnSync("prisma", ["migrate", "deploy"], {
          env,
          encoding: "utf8",
          stdio: ["inherit", "inherit", "pipe"],
        });
        if (result.stderr) process.stderr.write(result.stderr);
        if (result.error) console.error("Unable to launch Prisma migration command");
        return result;
      },
      (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      console.error,
    );
  } catch (error) {
    // Never echo a malformed connection string or its credentials.
    console.error(error instanceof TypeError ? "Invalid migration database URL" : error.message);
    process.exitCode = 1;
  }
}
