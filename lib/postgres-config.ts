import { X509Certificate } from "node:crypto";

/** pg URL SSL parameters override an explicit SSL object; remove them when a CA is supplied. */
export function postgresPoolConfig(databaseUrl: string, certificate?: string) {
  const limits = { max: 2, idleTimeoutMillis: 10000, connectionTimeoutMillis: 10000, query_timeout: 15000 };
  if (!certificate?.trim()) return { ...limits, connectionString: databaseUrl };
  const ca = certificate.trim().replace(/\\n/g, "\n");
  try { new X509Certificate(ca); }
  catch { throw new Error("SUPABASE_DB_CA_CERT must contain the database root certificate in PEM format"); }
  const url = new URL(databaseUrl);
  for (const parameter of ["sslmode", "sslrootcert", "sslcert", "sslkey", "ssl", "uselibpqcompat"]) url.searchParams.delete(parameter);
  return { ...limits, connectionString: url.toString(), ssl: { ca, rejectUnauthorized: true } };
}
