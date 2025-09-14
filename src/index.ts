import type {
  Client,
  LibsqlError,
  InStatement,
  Config as LibSQLConfig,
} from "@libsql/client";
import * as libSql from "@libsql/client";

import type { Params } from "./types";
import { cleanArguments, dbErrorHandler, getFullQueryString } from "./util";

interface Config extends LibSQLConfig {
  /** Callback for when a query fails, rather than throwing an exception */
  onQueryError?: (err: LibsqlError) => void;

  /** When a query is logged, run this callback */
  onQueryLog?: (query: string) => void;
}

function createClient(config: Config) {
  const client = libSql.createClient(config);

  const executeMultiple = (...args: Params<Client["executeMultiple"]>) => {
    return dbErrorHandler(
      () => client.executeMultiple(...args),
      config.onQueryError
    );
  };

  const batch = async (...args: Params<Client["batch"]>) => {
    return dbErrorHandler(() => client.batch(...args), config.onQueryError);
  };

  const execute = async (params: InStatement & { logQuery?: boolean }) => {
    if (params.logQuery) {
      const fullQueryString = getFullQueryString(params);
      config.onQueryLog?.(fullQueryString);
    }

    // For all placeholder-based queries, remove arguments that dont have associated placeholders, to prevent
    // query errors, but allow for simple conditional queries that include placeholders
    if (typeof params !== "string") {
      const args = cleanArguments(params.sql, params.args ?? {});

      return dbErrorHandler(
        () => client.execute({ sql: params.sql, args }),
        config.onQueryError
      );
    }

    return dbErrorHandler(() => client.execute(params), config.onQueryError);
  };

  return {
    ...client,
    execute,
    executeMultiple,
    batch,
  };
}

export type * from "./types";
export { libSql, createClient };
