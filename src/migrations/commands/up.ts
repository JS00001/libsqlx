import fs from "fs/promises";
import { CliCommandOptions, Transaction } from "../../types";

import { createClient } from "../../client";
import { createMigrationTableIfNotExists, logError, logSuccess, logWarn, validateMigrationDirectory } from "../util";

interface MigrationFile {
  up: (db: Transaction) => Promise<void>;
  down: (db: Transaction) => Promise<void>;
}

export default async function Up({ url, authToken, migrationPath, migrationTable }: CliCommandOptions) {
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

  // Query all of the migrations that have already been ran
  const result = await db.execute("SELECT filepath FROM " + migrationTable);
  const migratedFiles = (result?.rows ?? []).map((row) => String(row["filepath"]));

  const files = await fs.readdir(migrationPath);
  const migrationFiles = files.filter((file) => {
    const fileName = file.split(".")[0];
    return (file.endsWith(".ts") || file.endsWith(".js")) && !migratedFiles.includes(fileName);
  });

  if (!migrationFiles.length) {
    logWarn("No migrations to run");
    process.exit(0);
  }

  // Sort the files by timestamp, in ascending order so that they run in the order they were created
  migrationFiles.sort((a, b) => {
    const aTimestamp = parseInt(a.split("_")[0]);
    const bTimestamp = parseInt(b.split("_")[0]);
    return aTimestamp - bTimestamp;
  });

  // Apply the migrations
  for (const fileName of migrationFiles) {
    const migration: MigrationFile = (await import(`${migrationPath}/${fileName}`)).default;
    const normalizedFileName = fileName.split(".")[0];

    // Run the migration
    const transaction = await db.transaction();

    await migration
      .up(transaction)
      .then(() => transaction.commit())
      .catch(() => transaction.rollback());

    // Store the migration data
    await db.execute({
      sql: "INSERT INTO " + migrationTable + "(filepath, timestamp) VALUES (:filepath, :timestamp)",
      args: { filepath: normalizedFileName, timestamp: Date.now() },
    });

    logSuccess(`Applied migration ${fileName}`);
  }

  logSuccess(`Successfully ran ${migrationFiles.length} migration(s)`);
  process.exit(0);
}
