import { readFileSync } from "node:fs";
import path from "node:path";

export const AUTH_DIR = path.join(__dirname, "..", ".auth");
export const PASSWORD = "e2e passphrase long enough";

export type E2eUser = { id: string; email: string; fullName: string; storageState: string };
export type E2eUsers = { admin: E2eUser; manager: E2eUser; repA: E2eUser; repB: E2eUser };

/** Users created by global-setup for this run (unique emails, so runs never collide on a persistent database). */
export function e2eUsers(): E2eUsers {
  return JSON.parse(readFileSync(path.join(AUTH_DIR, "users.json"), "utf8"));
}

export const storageState = (key: keyof E2eUsers) => path.join(AUTH_DIR, `${key}.json`);
