import { mkdir, writeFile } from "fs/promises";

import { CliCommandOptions } from "../../types";
import { logError, logSuccess } from "../util";

interface NewCommandOptions extends CliCommandOptions {
  name: string;
}

export default async function New({ name, migrationPath }: NewCommandOptions) {
  const epochTime = Date.now();
  const fileName = `${epochTime}_${name}.ts`;

  const fileContents = `
import type { Transaction } from 'libsqlx';

export default class Migration_${epochTime}_${name} {
  public static async up(db: Transaction) {
    // Add your migration logic here
  }

  public static async down(db: Transaction) {
    // Add your rollback logic here
  }
}
  `;

  await mkdir(migrationPath, { recursive: true }).catch((e) => logError(e.message));
  await writeFile(`${migrationPath}/${fileName}`, fileContents).catch((e) => logError(e.message));

  logSuccess(`Created migration ${fileName}`);
  process.exit(0);
}
