export interface CliCommandOptions {
  /** The database URL */
  url: string;

  /** The path containing the migration files */
  migrationPath: string;

  /** The auth token to connect to the libSQL database */
  authToken?: string;

  /** The name of the table to store migrations in. Defaults to "migrations" */
  migrationTable?: string;
}
