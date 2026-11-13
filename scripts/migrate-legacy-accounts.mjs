// Moves the accounts made before src/accounts (KV `account:<username>` records, with
// `uuid-account:<uuid>` alongside) into D1 as password accounts, each protecting the
// link it protected before. Passwords keep working: the PBKDF2 hashes move as they are
// (src/accounts/password.ts reads them).
//   node scripts/migrate-legacy-accounts.mjs --local|--remote [--dry-run]
// KV is only read, never changed. Run it again safely: accounts and links already in D1
// are skipped (INSERT OR IGNORE on the username, the account row and the link).
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const q = (value) => `'${String(value).replaceAll("'", "''")}'`;

/**
 * The SQL that moves legacy records, `[{ username, uuid, passwordHash, salt, createdAt }]`,
 * into D1 for an app at `appOrigin` (whose host names the stand-in emails).
 */
export function legacySql(records, appOrigin) {
  const host = new URL(appOrigin).hostname;
  const statements = [];
  for (const r of records) {
    const username = String(r.username).toLowerCase();
    if (!/^[a-z0-9_]{3,30}$/.test(username) || !r.uuid || !r.passwordHash || !r.salt) {
      throw new Error(`Legacy account ${JSON.stringify(r.username)} is malformed`);
    }
    const userId = `legacy_${username}`;
    const at = new Date(Number(r.createdAt) || Date.now()).toISOString();
    statements.push(
      `INSERT OR IGNORE INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt", "username", "displayUsername") ` +
        `VALUES (${q(userId)}, ${q(username)}, ${q(`${username}@users.${host}.invalid`)}, 0, ${q(at)}, ${q(at)}, ${q(username)}, ${q(username)});`,
      `INSERT OR IGNORE INTO "account" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt") ` +
        `SELECT ${q(`legacy_${randomUUID()}`)}, "id", 'credential', "id", ${q(`pbkdf2-sha256$100000$${r.salt}$${r.passwordHash}`)}, ${q(at)}, ${q(at)} ` +
        `FROM "user" WHERE "id" = ${q(userId)} AND NOT EXISTS (SELECT 1 FROM "account" WHERE "userId" = ${q(userId)});`,
      `INSERT OR IGNORE INTO "protectedLink" ("id", "userId", "createdAt") ` +
        `SELECT ${q(r.uuid)}, "id", ${Number(r.createdAt) || Date.now()} FROM "user" WHERE "id" = ${q(userId)};`,
    );
  }
  return statements.join("\n");
}

async function main() {
  const target = process.argv.includes("--remote") ? "--remote" : process.argv.includes("--local") ? "--local" : undefined;
  if (!target) {
    console.error("usage: node scripts/migrate-legacy-accounts.mjs --local|--remote [--dry-run]");
    process.exit(2);
  }
  const wrangler = (args) => execFileSync("npx", ["wrangler", ...args], { stdio: ["ignore", "pipe", "inherit"] }).toString();
  const keys = JSON.parse(wrangler(["kv", "key", "list", "--binding", "DECKLISTEDITOR", target, "--prefix", "account:"]));
  const records = keys.map(({ name }) => ({
    username: name.slice("account:".length),
    ...JSON.parse(wrangler(["kv", "key", "get", "--binding", "DECKLISTEDITOR", target, name])),
  }));
  console.log(`${records.length} legacy account(s): ${records.map((r) => `${r.username} -> /${r.uuid}`).join(", ") || "none"}`);
  if (records.length === 0 || process.argv.includes("--dry-run")) return;

  const appOrigin = target === "--remote" ? "https://decklister.gpeake.com" : "http://127.0.0.1:8788";
  const dir = mkdtempSync(join(tmpdir(), "decklister-legacy-"));
  try {
    const file = join(dir, "legacy.sql");
    // Holds password hashes: readable by this user only, removed right after.
    writeFileSync(file, legacySql(records, appOrigin), { mode: 0o600 });
    wrangler(["d1", "execute", "decklister", target, "--yes", "--file", file]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  console.log("Moved. KV is unchanged.");
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
