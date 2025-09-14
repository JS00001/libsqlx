import { createClient } from "../../client";
import { CliCommandOptions } from "../types";

export default function Down({ url, authToken }: CliCommandOptions) {
  const db = createClient({ url, authToken });
}
