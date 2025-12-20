import fs from "fs/promises";

import type { MigrationFile } from "..";
import type { CliCommandOptions } from "../../types";

import { createClient } from "../../client";
import { createMigrationTableIfNotExists, logError, logSuccess, validateMigrationDirectory } from "../util";

export default async function Down({ url, migrationTable, migrationPath, authToken }: CliCommandOptions) {
  const db = createClient({
    url,
    authToken,
    onQueryError: (err) => {
      logError(`Something went wrong: ${err}`);
      process.exit(1);
    },
  });

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

  const files = await fs.readdir(migrationPath);
  const matchingFile = files.filter((file) => {
    const fileName = file.split(".")[0];
    return fileName === filepath;
  });

  if (!matchingFile.length) {
    logError(`Unable to find migration ${filepath}`);
    process.exit(0);
  }

  const migration: MigrationFile = (await import(`${migrationPath}/${matchingFile[0]}`)).default;

  // Run the migration
  const transaction = await db.transaction("write");

  await migration
    .down(transaction)
    .then(() => transaction.commit())
    .catch(() => transaction.rollback());

  // Store the migration data
  await db.execute({
    sql: "DELETE FROM " + migrationTable + " WHERE id = :id",
    args: { id },
  });

  logSuccess(`Reverted migration ${filepath}`);
  process.exit(0);
}
