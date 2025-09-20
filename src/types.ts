import type * as libSqlTypes from "@libsql/client";

export type Params<T extends (...args: any) => any> = T extends (...args: infer P) => any ? P : never;

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
  execute: (params: libSqlTypes.InStatement) => Promise<libSqlTypes.ResultSet | null>;
  batch: (...params: Params<libSqlTypes.Client["batch"]>) => Promise<libSqlTypes.ResultSet[] | null>;
}

export type OnQueryFinishData = {
  /** The amount of time the query took in milliseconds. This will be 0 if `queryTimings: true` is not set */
  time: number;
};
