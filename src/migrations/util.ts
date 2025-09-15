import fs from "fs/promises";

import { LibsqlxClient } from "../client";
import { queryString } from "../client/util";

const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";

const CHECK = "✔";
const CROSS = "✖";
const WARN = "⚠";

export const logSuccess = (message: string) => {
  console.log(`${GREEN}${CHECK}${RESET} ${message}`);
};

export const logError = (message: string) => {
  console.log(`${RED}${CROSS}${RESET} ${message}`);
};

export const logWarn = (message: string) => {
  console.log(`${YELLOW}${WARN}${RESET} ${message}`);
};

export const createMigrationTableIfNotExists = (db: LibsqlxClient, migrationTable: string = "migrations") => {
  return db.execute({
    sql: queryString(
      "CREATE TABLE IF NOT EXISTS " + migrationTable + "(",
      "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
      "  filepath TEXT,",
      "  timestamp INTEGER",
      ")"
    ),
  });
};

export const validateMigrationDirectory = async (migrationPath: string) => {
  try {
    await fs.access(migrationPath);
  } catch (e) {
    logError("Unable to find the migration directory. Make sure it exists");
    process.exit(0);
  }
};
