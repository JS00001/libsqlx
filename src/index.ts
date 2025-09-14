import { createClient as libSQLCreateClient } from "@libsql/client";
import type { Config, Client } from "@libsql/client";

function createClient(config: Config): Client {
  const client = libSQLCreateClient(config);

  return {
    ...client,
  };
}

export type * from "./types";
