"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { safeReturnPath } from "@/lib/auth-paths";
import "./email-auth.css";

export default function EmailAuth({ returnTo = "/", signOut = false, expired = false, register = false }: { returnTo?: string; signOut?: boolean; expired?: boolean; register?: boolean }) {
  const [mode, setMode] = useState<"login" | "register" | "link">(register ? "register" : "login");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState(""), [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false), [error, setError] = useState(expired ? "This sign-in link expired or was opened in a different browser. Please request a new link." : "");
  const configured = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (signOut) {
        const response = await fetch("/api/auth/sign-out", { method: "POST" });
        if (!response.ok) throw new Error("We couldn't sign you out. Please try again.");
        window.location.assign(safeReturnPath(returnTo));
      } else {
        const client = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
        const redirect = new URL("/auth/callback", window.location.origin);
        redirect.searchParams.set("next", safeReturnPath(returnTo));
        if (mode === "login") {
          const { error: failure } = await client.auth.signInWithPassword({ email: email.trim(), password });
          if (failure) throw new Error("Unable to sign in. Check your details and confirm your email, or use an email link.");
          setPassword(""); window.location.assign(safeReturnPath(returnTo));
        } else if (mode === "register") {
          const { data, error: failure } = await client.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirect.toString() } });
          if (failure) throw new Error("Unable to create an account. Use a stronger password or try again shortly.");
          setPassword("");
          if (data.session) window.location.assign(safeReturnPath(returnTo)); else setSent(true);
        } else {
          const { error: failure } = await client.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirect.toString(), shouldCreateUser: false } });
          if (failure) throw new Error("Unable to send a sign-in link. Create an account first, or try again shortly.");
          setSent(true);
        }
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Please try again shortly."); }
    finally { setBusy(false); }
  }
  return <main className="gd-auth"><Link className="gd-auth-brand" href="/">GOLDEN<br/>DELIGHTS</Link><div className="gd-auth-card">
    <p className="gd-auth-eyebrow">Your own little corner</p>
    <h1>{signOut ? "Until next time." : sent ? "A little joy, in your inbox." : "Welcome to Golden Delights."}</h1>
    <p>{signOut ? "Sign out of this device. Your saved addresses and orders will be here when you return." : sent ? "Open the sign-in link we sent to your email in this browser. If it doesn't arrive, check your spam folder." : "Create your account or sign in securely. Save your delivery details and follow every sweet celebration."}</p>
    {!configured && !signOut && <p role="alert" className="gd-auth-error">Account sign-in is being configured. Please check back shortly.</p>}
    {error && <p role="alert" className="gd-auth-error">{error}</p>}
    {!signOut && !sent && <div className="gd-auth-tabs" aria-label="Account access">{(["login", "register", "link"] as const).map(value => <button type="button" key={value} aria-pressed={mode === value} onClick={() => { setMode(value); setPassword(""); setError(""); }}>{value === "login" ? "Sign in" : value === "register" ? "Create account" : "Email link"}</button>)}</div>}
    {!sent ? <form onSubmit={submit}>{!signOut && <label>Email address<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254} placeholder="you@example.com"/></label>}
      {!signOut && mode !== "link" && <label>Password<input type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} value={password} onChange={event => setPassword(event.target.value)} required minLength={mode === "register" ? 10 : 1} maxLength={128}/>{mode === "register" && <small>Use at least 10 characters. Confirm your email to activate your account.</small>}</label>}
      <button disabled={busy || !signOut && !configured}>{busy ? "One moment…" : signOut ? "Sign out" : mode === "register" ? "Create my account" : mode === "login" ? "Sign in" : "Send my sign-in link"}<span aria-hidden="true">↗</span></button></form>
      : <button className="gd-auth-retry" onClick={() => setSent(false)}>Use a different email or try again</button>}
    <Link className="gd-auth-back" href={safeReturnPath(returnTo)}>Back to the bakery</Link>
  </div><p className="gd-auth-foot">Handcrafted in Bangalore. Made for your sweetest moments.</p></main>;
}
