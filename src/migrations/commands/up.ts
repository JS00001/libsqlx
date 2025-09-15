import fs from "fs/promises";
import { CliCommandOptions } from "../types";

import { logError } from "../util";
import { createClient } from "../../client";
import { queryString } from "../../client/util";

export default async function Up({ url, authToken, migrationPath, migrationTable }: CliCommandOptions) {
  const db = createClient({ url, authToken });

  // Check if the migration table exists, if not create it
  await db.execute({
    sql: queryString(
      "CREATE TABLE IF NOT EXISTS " + migrationTable + "(",
      "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
      "  filepath TEXT,",
      "  timestamp INTEGER",
      ")"
    ),
  });

  try {
    await fs.access(migrationPath);
  } catch (e) {
    logError("Unable to find the migration directory.");
    process.exit(0);
  }
}
