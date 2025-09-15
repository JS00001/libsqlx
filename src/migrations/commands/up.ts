import fs from "fs/promises";
import { CliCommandOptions } from "../types";

import { createClient } from "../../client";
import { createMigrationTableIfNotExists, logSuccess, logWarn, validateMigrationDirectory } from "../util";

export default async function Up({ url, authToken, migrationPath, migrationTable }: CliCommandOptions) {
  const db = createClient({ url, authToken });

  await validateMigrationDirectory(migrationPath);
  await createMigrationTableIfNotExists(db, migrationTable);

  // Query all of the migrations that have already been ran
  const result = await db.execute("SELECT filepath FROM " + migrationTable);
  const migratedFiles = (result?.rows ?? []).map((row) => String(row["filepath"]));

  const files = await fs.readdir(migrationPath);
  const migrationFiles = files.filter((file) => {
    return file.endsWith(".ts") && !migratedFiles.includes(file);
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
    const { default: migration } = await import(`${migrationPath}/${fileName}`);
    await migration.up(db);
    await db.execute({
      sql: "INSERT INTO " + migrationTable + "(filepath, timestamp) VALUES (:filepath, :timestamp)",
      args: { filepath: fileName, timestamp: Date.now() },
    });

    logSuccess(`Applied migration ${fileName}`);
  }

  logSuccess(`Successfully ran ${migrationFiles.length} migration(s)`);
}
