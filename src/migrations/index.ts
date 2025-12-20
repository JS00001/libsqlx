import { Command } from "commander";

import Up from "./commands/up";
import New from "./commands/new";
import Down from "./commands/down";

import packageJSON from "../../package.json";
import { CliCommandOptions, Transaction } from "../types";

export interface MigrationFile {
  up: (db: Transaction) => Promise<void>;
  down: (db: Transaction) => Promise<void>;
}

export function createLibsqlxMigrationCli(props: CliCommandOptions) {
  props.migrationTable = props.migrationTable ?? "migrations";

  const program = new Command();

  program.name("migrate").description("Migration CLI").version(packageJSON.version);

  program
    .command("up")
    .description("Apply all unapplied migrations")
    .action(() => Up(props));

  program
    .command("down")
    .description("Undo the last migration")
    .action(() => Down(props));

  program
    .command("new")
    .option("-n, --name <name>", "The name of the migration")
    .action((options) => {
      if (!options.name) {
        console.error("Please provide a name for the migration. Use the --name flag");
        process.exit(1);
      }

      New({ ...props, name: options.name });
    });

  program.parse(process.argv);
}
