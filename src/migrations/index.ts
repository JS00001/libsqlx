import { Command } from "commander";

import Up from "./commands/up";
import New from "./commands/new";
import Down from "./commands/down";

import { CliCommandOptions } from "./types";
import packageJSON from "../../package.json";

export function libSqlMigrationCli(props: CliCommandOptions) {
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

      New(props);
    });
}
