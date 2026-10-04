import test from "node:test";
import assert from "node:assert/strict";
import { authErrorMessage } from "../lib/auth-errors.ts";
test("signup distinguishes SMTP restrictions and limits from weak passwords",()=>{
  assert.match(authErrorMessage({code:"email_address_not_authorized"},"register"),/email service/);
  assert.match(authErrorMessage({code:"over_email_send_rate_limit"},"register"),/sending limit/);
  assert.match(authErrorMessage({code:"weak_password"},"register"),/password/);
});
test("auth errors never display raw provider messages or untrusted codes",()=>{
  const failure={code:"<script>secret</script>",message:"private data"};
  assert.doesNotMatch(authErrorMessage(failure,"login"),/secret|private|script/);
  assert.match(authErrorMessage({code:"invalid_credentials"},"login"),/create an account/);
  assert.match(authErrorMessage({status:401},"register"),/configured correctly/);
});
