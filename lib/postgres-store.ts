import { Pool, types, type PoolClient, type QueryResultRow } from "pg";
import { postgresPoolConfig } from "./postgres-config.ts";
types.setTypeParser(20, (value) => Number(value));
let pool: Pool | undefined;
function connection() {
  if (!process.env.DATABASE_URL) throw new Error("Database is not configured");
  return pool ??= new Pool(postgresPoolConfig(process.env.DATABASE_URL, process.env.SUPABASE_DB_CA_CERT));
}

// Translate only server-authored queries; customer values remain bound parameters.
export function postgresSQL(sql: string) {
  let next = sql.replace(/INSERT OR IGNORE INTO/gi, "INSERT INTO");
  if (/INSERT OR IGNORE INTO/i.test(sql)) next += " ON CONFLICT DO NOTHING";
  next = next.replace(/json_extract\(value,'\$\.([a-zA-Z]+)'\)/g, (_, key: string) => {
    const field = `(value->>'${key}')`;
    return ["featured", "available"].includes(key) ? `${field}::boolean::integer`
      : key === "priceCents" ? `${field}::bigint` : field;
  }).replace(/json_each\(\?\)/g, "jsonb_array_elements(?::jsonb)");
  let parameter = 0, quote = false, result = "";
  for (let index = 0; index < next.length; index++) {
    const char = next[index];
    if (char === "'") {
      result += char;
      if (quote && next[index + 1] === "'") { result += next[++index]; continue; }
      quote = !quote;
    } else result += char === "?" && !quote ? `$${++parameter}` : char;
  }
  return result.replace(/(\$\d+) IS NOT NULL/g, "$1::bigint IS NOT NULL");
}
type Executor = { query<T extends QueryResultRow>(sql: string, values: unknown[]): Promise<{ rows: T[]; rowCount: number | null }> };
export class PostgresStatement {
  constructor(readonly sql: string, readonly values: unknown[] = [], private readonly executor: () => Executor = connection) {}
  bind(...values: unknown[]) { return new PostgresStatement(this.sql, values, this.executor); }
  async all<T extends QueryResultRow>() {
    const result = await this.executor().query<T>(postgresSQL(this.sql), this.values);
    return { results: result.rows, success: true, meta: { changes: result.rowCount ?? 0 } };
  }
  async first<T extends QueryResultRow>(column?: string): Promise<T | null> {
    const row = (await this.all<T>()).results[0];
    return row ? column ? row[column] : row : null;
  }
  run() { return this.all<QueryResultRow>(); }
}
export function createPostgresDatabase(executor: () => Executor = connection,
  transaction: () => Promise<PoolClient> = () => connection().connect()) {
  return {
    prepare(sql: string) { return new PostgresStatement(sql, [], executor); },
    async batch(statements: PostgresStatement[]) {
      for (let attempt = 0; ; attempt++) {
        const client = await transaction();
        try {
          await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
          await client.query("SET LOCAL statement_timeout = '15s'");
          const results = [];
          for (const statement of statements) results.push(await new PostgresStatement(statement.sql, statement.values, () => client).run());
          await client.query("COMMIT");
          return results;
        } catch (error) {
          await client.query("ROLLBACK").catch(() => {});
          if (attempt >= 2 || !["40001", "40P01"].includes((error as { code?: string }).code ?? "")) throw error;
        } finally { client.release(); }
      }
    },
  };
}
export const postgresDatabase = createPostgresDatabase();
