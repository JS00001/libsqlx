<h1 align="center">🏖️ libSQLx</h1>
<p align="center">
  A lightweight wrapper around <a href="https://libsql.org">@libsql/client</a>
 that adds developer-friendly features like migrations, smarter error handling, query logging, sanitization, and more. Perfect for debugging, monitoring, and improving developer experience when working with libSQL.
</p>

## Table of Contents

- [Install](#install) - Get started using libSQLx
- [Quickstart](#quickstart) - A simple example of how to use libSQLx
- [Features](#features) - The features of libSQLx
  - [Migrations](#migrations) - Managing database migrations
  - [Job Queuing](#job-queuing) - Scheduling and running jobs
  - [Query Logging](#query-logging) - Logging queries and their parameters
  - [Error Handling](#error-handling) - Catching and handling errors
  - [Argument Cleaning](#argument-cleaning) - Removing unused arguments
  - [Utility Functions](#utility-functions) - Making working with libSQL easier
    - [queryString](#querystring) - Join a list of strings into a single string
    - [parameterize](#parameterize) - Take a list and return an object with its sql placeholder names
    - [Jsonify](#jsonify) - Convert a string to a JSON object
    - [sanitizeLike](#sanitizelike) - Sanitize a string to remove characters that would break glob patterns
    - [sanitizeSqlPath](#sanitizesqlpath) - Fully sanitize a string down to only alphanumeric characters

## Install

```bash
npm install libsqlx
```

## Quickstart

The example below sets up a basic libSQL connection, and handles logging and errors

```ts
import { createClient } from "libsqlx";

export const db = createClient({
  url: "https://db.libsql.com",
  authToken: process.env.AUTH_TOKEN,
  syncInterval: 60000,
  onQueryError: (err) => {
    console.error(err);
  },
  onQueryLog: (log) => {
    console.debug(log);
  },
});

await db.batch(
  [
    "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)",
    {
      sql: "INSERT INTO users(name) VALUES (:name)",
      args: { name: "John" },
    },
  ],
  "write"
);

await db.execute({
  sql: "SELECT * FROM users WHERE id = :id",
  args: { id: 1, excessValue: true },
});
```

## Features

### Migrations

libSQLx provides a simple way to manage database migrations. It can be used to apply changes to a database, and to rollback changes if needed. You can use migrations in any way you'd like, but we recommend setting up a `migrations` folder.

1. Create a `migrations/index.ts` file in your project
2. Adding the following to your `migrations/index.ts` file will allow you to use the libSQLx migration cli.

````ts
import { createLibsqlxMigrationCli } from "libsqlx";

createLibsqlxMigrationCli({
  migrationPath: __dirname + "/migrations",
  url: "https://db.example.com",
  authToken: "optional auth token",
})
```

3. The simplest way to install migrations is to install `tsx` as a dev dependency, and add the following to your `package.json`
```json
{
  "scripts": {
    "migrate": "tsx src/migrations/index.ts",
  }
}
````

4. To create a new migration, run `npm run migrate new --name "create_users_table"`

5. To run migrations, run `npm run migrate up`

6. To rollback migrations, run `npm run migrate down`

Thats it!

### Job Queuing

libSQLx provides a simple way to schedule and run jobs. libsqlX provides three ways of queueing and running jobs: `jobs.schedule(...)`, `jobs.queue(...)`, and `jobs.every(...)`.

To get started, start by creating a new instance of the `LibsqlxJobs` class.

```ts
import { LibsqlxJobs } from "libsqlx";

const jobs = new LibsqlxJobs({
  url: "https://db.libsql.com",
  authToken: process.env.AUTH_TOKEN,
  // The name of the table to use for jobs
  jobsTable: "jobs",
  // The number of milliseconds to wait between job checks
  processEvery: 1000,
  // The maximum number of times to retry a job before marking it as failed
  maxRetries: 3,
  // The maximum number of jobs to run at once
  maxJobs: 10
})
```

Once you have a new instance of the `LibsqlxJobs` class, you can start the job worker, and register jobs to be run.

```ts
// You must call `start` to start the job worker
await jobs.start();

// Register a job with the name `job_name`
jobs.register("job_name", (data) => {
  console.log(data);
});

// Add the 'job_name' job to the queue
jobs.queue("job_name", { message: "Hello world" });

// Schedule the job to run in 1 minute
jobs.schedule("in 1 minute", "job_name", { message: "Hello world" });

// schedule the job to run every minute
jobs.every("* * * * *", "job_name", { message: "Hello world" });
```

### Query Logging

When executing a parameterized query, it can be hard to debug what the query actually looks like. It can be extremely time consuming to manually inspect the query string. libSQLx exposes the `logQuery:true|false` parameter when executing a query. This flag works alongside the `onQueryLog: (log: string) => void` parameter passed when creating a new client.

**Example:**

```ts
import { createClient } from "libsqlx";

export const db = createClient({
  url: "https://db.libsql.com",
  authToken: process.env.AUTH_TOKEN,
  // Setup logging to log any query with `logQuery: true`
  onQueryLog: (log) => {
    console.debug(log);
  },
});

// This query will be logged as `SELECT * FROM users WHERE id = 1`
await db.execute({
  logQuery: true,
  sql: "SELECT * FROM users WHERE id = :id",
  args: { id: 1, excessValue: true },
});

// This query will not be logged
await db.execute({
  sql: "SELECT * FROM users WHERE id = :id",
  args: { id: 1, excessValue: true },
});
```

### Error Handling

libSQL throws exceptions when they occur. This can include errors from libSQL itself, malformed queries, or an entire host of other unpredictable errors. libSQLx provides a simple way to handle errors and manage them without having to try/catch them. The `onQueryError: (err: LibsqlError) => void` parameter is passed when creating a new client.

**Example:**

```ts
import { createClient } from "libsqlx";

export const db = createClient({
  url: "https://db.libsql.com",
  authToken: process.env.AUTH_TOKEN,
  // Log the error any time an issue occurs
  onQueryError: (err) => {
    console.error(err);
  },
});

// This query will throw an error, but it will be caught by the error handler
await db.execute({
  sql: "SELECT 1 WHERE id = :id FROM users,",
  args: { id: 1, excessValue: true },
});
```

### Argument Cleaning

libSQL will throw an error if an argument is not used in the query, but libSQLx gets in front of this error, and removes any excess arguments from the object. This is done to remove
the need for messy conditionals when working with parameterized queries.

**Example:**

```ts
import { createClient } from "libsqlx";

export const db = createClient({
  url: "https://db.libsql.com",
  authToken: process.env.AUTH_TOKEN,
});

// This query will work just fine, the excess argument will be removed by libSQLx
await db.execute({
  sql: "SELECT * FROM users WHERE id = :id",
  args: { id: 1, excessValue: true },
});
```

### Utility Functions

libSQLx provides a few utility functions to make working with libSQL a little easier.

#### `sanitize`

Removes characters from a string that would break a SQL query. This is useful for sanitizing user input to prevent SQL injection attacks.

```ts
import { sanitize } from "libsqlx";

const userInputtedValue = "foo';--bar";

const sanitizedValue = sanitize(userInputtedValue);

await db.execute(`SELECT * FROM users WHERE name = ${sanitizedValue}`);

// Returns
("SELECT * FROM users WHERE name = 'foo\\';--bar'")
```

#### `queryString`

Returns a single string for SQL queries, allowing for better formatting and readability.

```ts
import { queryString } from "libsqlx";

await db.execute({
  sql: queryString(
    "SELECT",
    "  email,",   
    "  lastName,",
    "  firstName",
    "FROM users", 
    "LEFT JOIN addresses ON users.id = addresses.user_id",
    "WHERE id = :id", 
    "  AND email = :email"
  ),
  args: { id: 1, email: "johndoe@gmail.com" },
});

// Returns
("SELECT * FROM users WHERE id = :id");
```

#### `parameterize`

Takes an array of values and returns an object with its sql placeholder names, and its prepared arguments. Perfect for `IN (...)` queries.

```ts
import { parameterize } from "libsqlx";

const { args, placeholders } = parameterize("id", [1, 2, 3]);

await db.execute({
  sql: queryString("SELECT * FROM users WHERE id IN (", placeholders, ")"),
  args: args,
});
```

#### `Jsonify`

Similar to parsing row results using `String()`, `Number()`, `Date()`, etc. This function will parse a column as JSON, where it is either parsed as an object, or as null

```ts
import { Jsonify } from "libsqlx";

const results = await db.execute("SELECT * FROM users");

return results.map((result) => ({
  id: Number(result["id"]),
  name: String(result["name"]),
  // Parse the users address object as JSON
  address: Jsonify(result["address"]),
}));
```

#### `sanitizeLike`

When using `LIKE` in a SQL query, you need to pass the wildcards as a part of the parameter. This function will sanitize the parameter to escape any other wildcards from the string.

```ts
import { sanitizeLike } from "libsqlx";

await db.execute({
  sql: "SELECT * FROM users WHERE name LIKE :name",
  args: { name: sanitizeLike("foo%bar") },
});
```

#### `sanitizeSqlPath`

JSON paths cannot be parameterized in SQL, so this function will sanitize a string to remove characters that would break the path, or allow for SQL injection. The only
characters allowed are alphanumeric characters and underscores.

```ts
import { sanitizeSqlPath } from "libsqlx";

const userInputtedValue = "foo';--bar";
const sanitizedPath = sanitizeSqlPath(userInputtedValue);

await db.execute(`SELECT * FROM users WHERE JSON_EXTRACT(metadata, '$.${sanitizedPath}') IS NOT NULL`);
```
