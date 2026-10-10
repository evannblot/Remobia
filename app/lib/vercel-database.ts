import { neon, type FullQueryResults, type NeonQueryFunction } from "@neondatabase/serverless";

/** Translate our parameterized SQL without changing question marks in literals. */
export function postgresSql(sql: string): string {
  let quote = "", number = 0, output = "";
  for (let index = 0; index < sql.length; index++) {
    const char = sql[index];
    if (quote) {
      output += char;
      if (char === quote) {
        if (sql[index + 1] === quote) output += sql[++index];
        else quote = "";
      }
    } else if (char === "'" || char === '"') { quote = char; output += char; }
    else output += char === "?" ? `$${++number}` : char;
  }
  return output;
}

function result<T>(value: FullQueryResults<false>): D1Result<T> {
  return { success: true, results: value.rows as T[], meta: {
    changes: value.command === "SELECT" ? 0 : value.rowCount,
    duration: 0, last_row_id: 0, changed_db: value.command !== "SELECT",
    size_after: 0, rows_read: value.command === "SELECT" ? value.rowCount : 0,
    rows_written: value.command === "SELECT" ? 0 : value.rowCount,
  } };
}

/** D1-compatible operations used by the existing handlers, backed by real Postgres. */
export function createVercelDatabase(url: string, driver?: NeonQueryFunction<false, true>): D1Database {
  const sql = driver ?? neon(url, { fullResults: true });
  class Statement {
    readonly text: string;
    readonly values: unknown[];
    constructor(text: string, values: unknown[] = []) { this.text = text; this.values = values; }
    bind(...values: unknown[]) { return new Statement(this.text, values); }
    async all<T>() { return result<T>(await sql.query(postgresSql(this.text), this.values, { fetchOptions: { signal: AbortSignal.timeout(10_000) } })); }
    async run<T>() { return this.all<T>(); }
    async first<T>(column?: string) {
      const value = (await this.all<Record<string, unknown>>()).results[0];
      return value ? (column === undefined ? value : value[column]) as T : null;
    }
  }
  return {
    prepare(text: string) { return new Statement(text); },
    async batch(statements: Statement[]) {
      if (statements.some(statement => !(statement instanceof Statement))) throw new Error("Foreign database statement");
      for (let attempt = 0; ; attempt++) {
        try {
          const values = await sql.transaction(tx => statements.map(statement =>
            tx.query(postgresSql(statement.text), statement.values)), {
            fullResults: true, isolationLevel: "Serializable", fetchOptions: { signal: AbortSignal.timeout(15_000) },
          });
          return values.map(value => result(value));
        } catch (error) {
          // These SQLSTATEs guarantee rollback. An ambiguous network failure is never retried.
          const code = error && typeof error === "object" && "code" in error ? error.code : null;
          if (attempt >= 2 || (code !== "40001" && code !== "40P01")) throw error;
        }
      }
    },
  } as unknown as D1Database;
}
