import type * as libSqlTypes from "@libsql/client";

export type Params<T extends (...args: any) => any> = T extends (...args: infer P) => any ? P : never;

export enum JobPriority {
  Low = 1,
  Medium = 2,
  High = 3,
}

export enum JobStatus {
  Pending = "pending",
  Running = "running",
  Failed = "failed",
  Completed = "completed",
}

export interface LibsqlxConfig extends libSqlTypes.Config {
  /** Whether to time the length of all queries or not. If true, returns the time as a part of the onQueryFinish callback */
  timeQueries?: boolean;

  /** When a query fails, rather than throwing an exception, you will receive the error via this callback */
  onQueryError?: (err: string) => void;

  /** When a query is logged using `logQuery: true`, you will receive the full query string via this callback */
  onQueryLog?: (query: string) => void;

  /** When a query finishes, gather data about the query from this callback */
  onQueryFinish?: (data: OnQueryFinishData) => void;
}

export interface LibsqlxClient extends Omit<libSqlTypes.Client, "execute" | "executeMultiple" | "batch"> {
  executeMultiple: (sql: string) => Promise<void | null>;
  execute: (params: libSqlTypes.InStatement & { logQuery?: boolean }) => Promise<libSqlTypes.ResultSet | null>;
  batch: (...params: Params<libSqlTypes.Client["batch"]>) => Promise<libSqlTypes.ResultSet[] | null>;
}

export type OnQueryFinishData = {
  /** The amount of time the query took in milliseconds. This will be 0 if `queryTimings: true` is not set */
  time: number;
};

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

export interface CreateJobsOptions {
  /** The database URL */
  url: string;

  /** The name of the table to store jobs in. Defaults to "jobs" */
  jobsTable?: string;

  /** The auth token to connect to the libSQL database */
  authToken?: string;

  /** How often to process jobs in milliseconds. Defaults to 5000 */
  processEvery?: number;

  /** The maximum number of retries for each job. Defaults to 3 */
  maxRetries?: number;

  /** The maximum number of jobs to execute at once. Defaults to 10 */
  maxJobs?: number;
}

export interface JobOptions {
  /** The priority of the job */
  priority?: number;
}
