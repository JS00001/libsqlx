import { LibsqlError, type InStatement } from "@libsql/client";

import { LibsqlxConfig } from "../types";

const NEWLINE_CHAR = "\t";

/**
 * Join a list of strings into a single string for
 * SQL queries
 *
 * @example
 * queryString(
 *   "SELECT * FROM users",
 *   "WHERE id = :id"
 * )
 * // Returns
 * "SELECT * FROM users WHERE id = :id"
 */
export const queryString = (...args: string[]) => {
  return args.join(NEWLINE_CHAR);
};

/**
 * Take a list and return an object with its sql placeholder names, and
 * its prepared arguments
 *
 * @example
 * paramterize("id", [1, 2, 3])
 * // Returns
 * {
 *   args: { id0: 1, id1: 2, id2: 3 },
 *   placeholders: ":id0, :id1, :id2"
 * }
 */
export const paramterize = (key: string, value: Array<string | number>) => {
  return {
    args: Object.fromEntries(value.map((v, i) => [`${key}${i}`, v])),
    placeholders: value.map((_, i) => `:${key}${i}`).join(", "),
  };
};

/**
 * Parse a column as JSON, where it is either parsed as an object, or as
 * null
 *
 * @returns A parsed object, or null
 */
export const Jsonify = <T extends Record<string, any> = Record<string, any>>(value: string) => {
  try {
    return JSON.parse(value) as T;
  } catch (err) {
    return null;
  }
};

/**
 * Logs the full query string that will be executed.
 *
 * @remarks
 * ⚠️ DO NOT EXECUTE THIS STRING. By default, this is for logging only, to see
 * what the query would look like with its parameters in place. This does NOT
 * sanitize the parameters. In fact, it unsanitizes them.
 */
export const getFullQueryString = (params: InStatement) => {
  if (typeof params === "string") {
    return params;
  }

  let queryString = params.sql;

  for (const [key, value] of Object.entries(params.args ?? {})) {
    queryString = queryString.replace(`:${key}`, `'${value}'`);
  }

  let fullString = "";
  const lines = queryString.split(NEWLINE_CHAR);
  for (const line of lines) {
    if (!line.trim()) continue;
    fullString += `${line}\n`;
  }

  return fullString;
};

/**
 * Sanitize a string to remove characters that would break glob patterns
 * from the string
 *
 * @example
 * sanitizeLike('foo%bar')
 * // Returns
 * 'foo\\%bar'
 */
export const sanitizeLike = (str: string) => {
  return str
    .replace(/\\/g, "\\\\") // escape backslashes
    .replace(/%/g, "\\%") // escape %
    .replace(/_/g, "\\_"); // escape _
};

/**
 * Fully sanitize a string down to only alphanumeric characters. Useful for JSON key paths
 * or other string values that cannot be parameterized, but need to be sanitized
 *
 * @example
 * sanitizeSqlPath('foo';--bar')
 * // Returns
 * 'foobar'
 */
export const sanitizeSqlPath = (str: string) => {
  return str.replace(/[^a-zA-Z0-9_]/g, "");
};

/**
 * SQlite will throw an error if an argument is not used in the query, but this function removes
 * any excess arguments from the object
 */
export const cleanArguments = (sql: string, args: Record<string, any>) => {
  for (const key in args) {
    if (!sql.includes(`:${key}`)) {
      delete args[key];
    }
  }

  return args;
};

/**
 * Gracefully handle database errors. If the error is not a libSQL error, it will still
 * be thrown
 */
export const queryHandler = async <T>(fn: () => T, config: LibsqlxConfig): Promise<T | null> => {
  try {
    if (!config.timeQueries) {
      const result = await fn();
      config.onQueryFinish?.({ time: 0 });
      return result;
    }

    const startTime = process.hrtime();
    const result = await fn();
    const endTime = process.hrtime(startTime);
    const timeMs = endTime[0] * 1000 + endTime[1] / 1000000;

    config.onQueryFinish?.({ time: timeMs });

    return result;
  } catch (err) {
    // Specifically handle libsql errors,
    if (err instanceof LibsqlError) {
      config.onQueryError?.(err.message);
      return null;
    }

    throw err;
  }
};

/**
 * Converts a date to the standard sqlite date format `YYYY-MM-DD HH:MM:SS`
 */
export const toSqliteDateString = (date: Date) => {
  return date.toISOString().slice(0, 19).replace("T", " ");
};
