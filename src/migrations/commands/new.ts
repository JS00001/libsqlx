import { createClient } from "../../client";
import { CliCommandOptions } from "../types";

export default function New({ url, authToken }: CliCommandOptions) {
  const db = createClient({ url, authToken });
}
