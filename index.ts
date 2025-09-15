import { libSqlMigrationCli } from "./src/migrations/index";

libSqlMigrationCli({
  migrationPath: __dirname + "/migrations",
  url: "https://example.libsql.com",
});
