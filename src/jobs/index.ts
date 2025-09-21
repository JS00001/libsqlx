import { parseDate } from "chrono-node";

import { CreateJobsOptions, JobOptions, LibsqlxClient } from "../types";
import { createClient } from "../client";
import { queryString } from "../client/util";

interface JobRegistryValue {
  name: string;
  options: JobOptions;
  fn: (data: any) => void;
}

export class LibsqlxJobs {
  private db: LibsqlxClient;
  private options: CreateJobsOptions;
  private jobsRegistry: Record<string, JobRegistryValue> = {};

  constructor(options: CreateJobsOptions) {
    this.options = options;
    this.db = createClient({
      url: options.url,
      authToken: options.authToken,
    });
  }

  private get jobsTable() {
    return this.options.jobsTable ?? "jobs";
  }

  public start = async () => {
    await this.db.execute(
      queryString(
        "CREATE TABLE IF NOT EXISTS " + this.jobsTable + " (",
        "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
        "  name TEXT NOT NULL,",
        "  data TEXT,",
        "  runAt DATETIME NOT NULL,",
        "  priority INTEGER DEFAULT 0,",
        "  cron TEXT,",
        "  attempts INTEGER DEFAULT 0,",
        "  status TEXT CHECK (status IN ('pending', 'running', 'failed', 'completed')) DEFAULT 'pending',",
        "  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP"
      )
    );

    await this.db.executeMultiple(
      queryString(
        "CREATE INDEX IF NOT EXISTS idx_" + this.jobsTable + "_priority ON " + this.jobsTable + " (priority);",
        "CREATE INDEX IF NOT EXISTS idx_" + this.jobsTable + "_status_runAt ON " + this.jobsTable + " (status, runAt);"
      )
    );
  };

  /**
   * Register a job to be run
   */
  public register = <T = any>(name: string, options: JobOptions, fn: (data: T) => void) => {
    this.jobsRegistry[name] = { name, options, fn };
  };

  public queue = async <T = any>(name: string, data?: T) => {
    const job = this.jobsRegistry[name];
    if (!job) return;

    await this.db.execute({
      sql: queryString(
        "INSERT INTO " + this.jobsTable,
        "(name, data, runAt, priority)",
        "VALUES (:name, :data, CURRENT_TIMESTAMP, :priority)"
      ),
      args: {
        name: job.name,
        priority: job.options.priority ?? 0,
        data: data ? JSON.stringify(data) : null,
      },
    });
  };

  public schedule = async <T>(date: string, name: string, data?: T) => {
    const job = this.jobsRegistry[name];
    if (!job) return;

    const parsedDate = parseDate(date);
    if (!parsedDate) return;

    await this.db.execute({
      sql: queryString(
        "INSERT INTO " + this.jobsTable,
        "(name, data, runAt, priority)",
        "VALUES (:name, :data, :runAt, :priority)"
      ),
      args: {
        name: job.name,
        priority: job.options.priority ?? 0,
        data: data ? JSON.stringify(data) : null,
        runAt: parsedDate.toISOString(),
      },
    });
  };

  public every = async <T>(cronString: string, name: string, data?: T) => {};
}
