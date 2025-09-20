import * as libSql from "@libsql/client";
import type * as libSqlTypes from "@libsql/client";

import type { LibsqlxClient, LibsqlxConfig, Params } from "../types";
import { cleanArguments, queryHandler, getFullQueryString } from "./util";

export function createClient(config: LibsqlxConfig): LibsqlxClient {
  const client = libSql.createClient(config);

  /**
   * Execute a sequence of SQL statements separated by semicolons.
   * The statements are executed sequentially on a new logical database connection. If a statement fails, further statements are not executed and this method throws an error. All results from the statements are ignored.
   * We do not wrap the statements in a transaction, but the SQL can contain explicit transaction-control statements such as BEGIN and COMMIT.
   * This method is intended to be used with existing SQL scripts, such as migrations or small database dumps. If you want to execute a sequence of statements programmatically, please use batch instead.
   */
  const executeMultiple = async (...args: Params<libSqlTypes.Client["executeMultiple"]>) => {
    return queryHandler(() => client.executeMultiple(...args), config);
  };

  /**
   * Execute a batch of SQL statements in a transaction.
   * The batch is executed in its own logical database connection and the statements are wrapped in a transaction. This ensures that the batch is applied atomically: either all or no changes are applied.
   * The mode parameter selects the transaction mode for the batch; please see TransactionMode for details. The default transaction mode is "deferred".
   * If any of the statements in the batch fails with an error, the batch is aborted, the transaction is rolled back and the returned promise is rejected.
   * This method provides non-interactive transactions. If you need interactive transactions, please use the transaction method.
   */
  const batch = async (...args: Params<libSqlTypes.Client["batch"]>) => {
    return queryHandler(() => client.batch(...args), config);
  };

  /**
   * Execute a single SQL statement.
   * Every statement executed with this method is executed in its own logical database connection.
   * If you want to execute a group of statements in a transaction, use the batch or the * transaction methods.
   */
  const execute = async (params: libSqlTypes.InStatement & { logQuery?: boolean }) => {
    if (params.logQuery) {
      const fullQueryString = getFullQueryString(params);
      config.onQueryLog?.(fullQueryString);
    }

    // For all placeholder-based queries, remove arguments that dont have associated placeholders, to prevent
    // query errors, but allow for simple conditional queries that include placeholders
    if (typeof params !== "string") {
      const args = cleanArguments(params.sql, params.args ?? {});

      return queryHandler(() => client.execute({ sql: params.sql, args }), config);
    }

    return queryHandler(() => client.execute(params), config);
  };

  return { ...client, execute, executeMultiple, batch };
}
