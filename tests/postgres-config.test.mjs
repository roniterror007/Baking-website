import test from "node:test";
import assert from "node:assert/strict";
import { rootCertificates } from "node:tls";
import pg from "pg";
import { postgresPoolConfig } from "../lib/postgres-config.ts";
const uri="postgresql://postgres.project:p%40ss@db.example.test:6543/postgres?sslmode=verify-full&application_name=bakery";
test("explicit root CA survives pg URL parsing and retains certificate verification",()=>{
  const cert=rootCertificates[0];
  for(const mode of ["verify-full","require","no-verify","disable"]) {
    const config=postgresPoolConfig(uri.replace("verify-full",mode),cert);
    const client=new pg.Client(config);
    assert.equal(client.connectionParameters.ssl.ca,cert.trim());
    assert.equal(client.connectionParameters.ssl.rejectUnauthorized,true);
    assert.equal(client.connectionParameters.host,"db.example.test");
    assert.equal(client.connectionParameters.password,"p@ss");
    assert.equal(new URL(config.connectionString).searchParams.get("application_name"),"bakery");
    assert.equal(new URL(config.connectionString).searchParams.has("sslmode"),false);
  }
});
test("escaped certificate newlines are normalized and invalid certificates fail closed",()=>{
  const cert=rootCertificates[0];
  assert.equal(postgresPoolConfig(uri,cert.replace(/\n/g,"\\n")).ssl.ca,cert.trim());
  assert.throws(()=>postgresPoolConfig(uri,"not a certificate"),/PEM format/);
  assert.equal(postgresPoolConfig(uri).connectionString,uri);
});
