import { CliCommandOptions } from "../types";
import { createMigrationTableIfNotExists, logError, logSuccess, validateMigrationDirectory } from "../util";

import { createClient } from "../../client";

export default async function Down({ url, migrationTable, migrationPath, authToken }: CliCommandOptions) {
  const db = createClient({ url, authToken });

  await validateMigrationDirectory(migrationPath);
  await createMigrationTableIfNotExists(db, migrationTable);

  // Query the last migration that was ran
  const result = await db.execute("SELECT id, filepath FROM " + migrationTable + " ORDER BY timestamp DESC LIMIT 1");

  if (!result || result.rows.length === 0) {
    logError("No migrations have been ran");
    process.exit(0);
  }

  const id = result.rows[0]["id"];
  const filepath = result.rows[0]["filepath"];
  const { default: migration } = await import(`${migrationPath}/${filepath}`);

  await migration.down(db);
  await db.execute({
    sql: "DELETE FROM " + migrationTable + " WHERE id = :id",
    args: { id },
  });

  logSuccess(`Reverted migration ${filepath}`);
}
