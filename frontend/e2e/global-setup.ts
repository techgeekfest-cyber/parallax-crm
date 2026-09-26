import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { FullConfig } from "@playwright/test";

import { apiLogin, write } from "./support/api";
import { AUTH_DIR, PASSWORD, type E2eUser, type E2eUsers } from "./support/users";

/**
 * Signs in as the bootstrap admin, creates this run's users through the real API, and saves a signed-in browser
 * state for each. Nothing is inserted into the database directly.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL!;
  const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "admin@parallax.local";
  const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "parallax-local-admin";
  mkdirSync(AUTH_DIR, { recursive: true });

  const admin = await apiLogin(baseURL, adminEmail, adminPassword);
  const adminMe = await (await admin.get("/api/v1/auth/me")).json();
  await admin.storageState({ path: path.join(AUTH_DIR, "admin.json") });

  const run = Date.now().toString(36);
  const create = async (key: string, firstName: string, lastName: string, role: string): Promise<E2eUser> => {
    const email = `${key.toLowerCase()}.${run}@e2e.parallax.test`;
    const response = await write(admin, "post", "/api/v1/users", { email, firstName, lastName, role, password: PASSWORD });
    if (!response.ok()) throw new Error(`Creating ${email} failed: ${response.status()} ${await response.text()}`);
    const user = await response.json();
    const context = await apiLogin(baseURL, email, PASSWORD);
    const storageState = path.join(AUTH_DIR, `${key}.json`);
    await context.storageState({ path: storageState });
    await context.dispose();
    return { id: user.id, email, fullName: user.fullName, storageState };
  };

  const users: E2eUsers = {
    admin: { id: adminMe.id, email: adminEmail, fullName: adminMe.fullName, storageState: path.join(AUTH_DIR, "admin.json") },
    manager: await create("manager", "Morgan", `Reyes ${run}`, "SALES_MANAGER"),
    repA: await create("repA", "Avery", `Stone ${run}`, "SALES_REP"),
    repB: await create("repB", "Blake", `Hart ${run}`, "SALES_REP"),
  };
  writeFileSync(path.join(AUTH_DIR, "users.json"), JSON.stringify(users, null, 2));
  await admin.dispose();
}
