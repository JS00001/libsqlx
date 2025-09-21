import parser from "cron-parser";
import { Row } from "@libsql/client";
import { parseDate } from "chrono-node";

import { createClient } from "../client";
import { toSqliteDateString } from "./util";
import { Jsonify, queryString } from "../client/util";
import { CreateJobsOptions, JobOptions, JobStatus, LibsqlxClient } from "../types";

interface JobRegistryValue {
  name: string;
  options: JobOptions;
  fn: (data: any) => void;
}

export class LibsqlxJobs {
  private db: LibsqlxClient;
  private options: CreateJobsOptions;
  private jobsRegistry: Record<string, JobRegistryValue> = {};

  // Jobs worker information
  private activeJobs = 0;
  private isRunning = false;

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

  private get maxJobs() {
    return this.options.maxJobs ?? 10;
  }

  private get processEvery() {
    return this.options.processEvery ?? 5000;
  }

  private get maxRetries() {
    return this.options.maxRetries ?? 3;
  }

  public async start() {
    await this.setupTables();
    await this.setupJobWorker();
  }

  /**
   * Register a job to be run
   */
  public register<T = any>(name: string, options: JobOptions, fn: (data: T) => void) {
    this.jobsRegistry[name] = { name, options, fn };
  }

  /**
   * Queue a job to run instantly based on its
   * priority
   */
  public async queue<T = any>(name: string, data?: T) {
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
  }

  /**
   * Schedule a job to run in the future. This can use a date string, or a human-readable string
   * such as 'in 10 minutes' or 'next week'
   */
  public async schedule<T>(date: string, name: string, data?: T) {
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
        runAt: toSqliteDateString(parsedDate),
      },
    });
  }

  /**
   * Schedule a job to run every time the cron string is met
   */
  public async every<T>(cronString: string, name: string, data?: T) {
    const job = this.jobsRegistry[name];
    if (!job) return;

    const interval = parser.parse(cronString);
    const runAt = interval.next().toDate();

    await this.db.execute({
      sql: queryString(
        "INSERT INTO " + this.jobsTable,
        "(name, data, runAt, priority, cron)",
        "VALUES (:name, :data, :runAt, :priority, :cron)"
      ),
      args: {
        name: job.name,
        priority: job.options.priority ?? 0,
        data: data ? JSON.stringify(data) : null,
        runAt: toSqliteDateString(runAt),
        cron: cronString,
      },
    });
  }

  /**
   * Creates the jobs table and sets up indexes on it
   */
  private async setupTables() {
    const jobStatuses = Object.values(JobStatus)
      .map((s) => `'${s}'`)
      .join(", ");

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
        "  status TEXT CHECK (status IN ( " + jobStatuses + ")) DEFAULT '" + JobStatus.Pending + "'",
        "  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP",
        "  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP",
        ")"
      )
    );

    await this.db.executeMultiple(
      queryString(
        "CREATE INDEX IF NOT EXISTS idx_" + this.jobsTable + "_priority ON " + this.jobsTable + " (priority);",
        "CREATE INDEX IF NOT EXISTS idx_" + this.jobsTable + "_status_runAt ON " + this.jobsTable + " (status, runAt);"
      )
    );
  }

  /**
   * Sets up the jobs worker to run automatically
   */
  private async setupJobWorker() {
    if (this.isRunning) return false;
    this.isRunning = true;

    const loop = async () => {
      try {
        if (this.activeJobs < this.maxJobs) {
          const limit = this.maxJobs - this.activeJobs;

          const res = await this.db.execute({
            sql: queryString(
              "SELECT *",
              "FROM " + this.jobsTable,
              "WHERE status = :status AND runAt <= CURRENT_TIMESTAMP",
              "ORDER BY priority DESC, runAt ASC",
              "LIMIT :limit"
            ),
            args: {
              status: JobStatus.Pending,
              limit,
            },
          });

          const rows = res?.rows ?? [];

          for (const row of rows) {
            this.activeJobs++;
            this.processJob(row).finally(() => {
              this.activeJobs--;
            });
          }

          setTimeout(loop, this.processEvery);
        }
      } catch (err) {
        console.error(err);
      }
    };

    loop();
  }

  private async processJob(row: Row) {
    const id = Number(row["id"]);
    const name = String(row["name"]);
    const attempts = Number(row["attempts"]) + 1;

    const cron = row["cron"] ? String(row["cron"]) : null;
    const data = row["data"] ? Jsonify(String(row["data"])) : null;

    const job = this.jobsRegistry[name];
    if (!job) return;

    await this.db.execute({
      sql: queryString(
        "UPDATE " + this.jobsTable,
        "SET status = :status, attempts = :attempts, updatedAt = CURRENT_TIMESTAMP",
        "WHERE id = :id"
      ),
      args: {
        id,
        attempts,
        status: JobStatus.Pending,
      },
    });

    try {
      await Promise.resolve(job.fn(data));

      await this.db.execute({
        sql: queryString("UPDATE " + this.jobsTable, "SET status = :status, updatedAt = CURRENT_TIMESTAMP", "WHERE id = :id"),
        args: {
          id,
          status: JobStatus.Completed,
        },
      });

      //  If this is a cronjob, schedule the next run
      if (cron) {
        const interval = parser.parse(cron);
        const nextRun = interval.next().toDate();

        await this.db.execute({
          sql: queryString(
            "INSERT INTO " + this.jobsTable,
            "(name, data, runAt, priority, cron)",
            "VALUES (:name, :data, :runAt, :priority, :cron)"
          ),
          args: {
            name: job.name,
            priority: job.options.priority ?? 0,
            data: data ? JSON.stringify(data) : null,
            runAt: toSqliteDateString(nextRun),
            cron,
          },
        });
      }
    } catch (err) {
      await this.db.execute({
        sql: queryString("UPDATE " + this.jobsTable, "SET status = :status, updatedAt = CURRENT_TIMESTAMP", "WHERE id = :id"),
        args: {
          id,
          status: attempts >= this.maxRetries ? JobStatus.Failed : JobStatus.Pending,
        },
      });
    }
  }
}
