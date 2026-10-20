"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ShieldCheck } from "lucide-react";

type AuthFormProps = { mode: "login" | "signup" };
type AccountType = "EMPLOYEE" | "HR";

const accountOptions: { id: AccountType; name: string; description: string }[] = [
  { id: "EMPLOYEE", name: "Employee", description: "Apply to join a department" },
  { id: "HR", name: "HR", description: "Human resources access" },
];

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const isSignup = mode === "signup";
  const [accountType, setAccountType] = useState<AccountType>("EMPLOYEE");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (isSignup && password !== confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, ...(isSignup ? { accountType } : {}) }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Unable to continue. Please try again.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Could not reach PatrolDesk. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-story">
        <Link className="auth-brand" href="/login"><span className="brand-mark"><ShieldCheck size={18} /></span><span>patrol<span className="brand-light">desk</span></span></Link>
        <div className="auth-story-copy"><span className="auth-overline">WESTBRIDGE PUBLIC SAFETY</span><h1>One roster.<br />One standard.</h1><p>Personnel, training, and duty operations in one place.</p></div>
        <div className="auth-story-foot"><span>OPERATIONS PORTAL</span><span>SECURE PERSONNEL ACCESS</span></div>
      </section>
      <section className="auth-panel">
        <div className="auth-form-wrap">
          <div className="auth-mobile-brand"><span className="brand-mark"><ShieldCheck size={18} /></span><span>patrol<span className="brand-light">desk</span></span></div>
          <span className="auth-kicker">{isSignup ? "NEW PERSONNEL" : "PERSONNEL ACCESS"}</span>
          <h2>{isSignup ? "Create your account" : "Welcome back"}</h2>
          <p className="auth-subtitle">{isSignup ? "Register to begin your department onboarding." : "Sign in to continue to your operations portal."}</p>

          <form className="auth-form" onSubmit={handleSubmit}>
            {isSignup && <fieldset className="account-type-field"><legend>Account type</legend><div className="account-options">{accountOptions.map((option) => <label key={option.id} className={`account-option ${accountType === option.id ? "account-option-selected" : ""}`}><input type="radio" name="accountType" value={option.id} checked={accountType === option.id} onChange={() => setAccountType(option.id)} /><span className="account-option-copy"><b>{option.name}</b><small>{option.description}</small></span><span className="radio-mark" /></label>)}</div>{accountType === "HR" && <p className="approval-note">HR access requires administrator approval. Employee accounts request FTO or Supervisor access from inside the portal.</p>}</fieldset>}
            <label className="auth-label" htmlFor="username">Username<input id="username" name="username" autoComplete="username" minLength={3} maxLength={32} required value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Your username" /></label>
            <label className="auth-label" htmlFor="password">Password<input id="password" name="password" type="password" autoComplete={isSignup ? "new-password" : "current-password"} minLength={isSignup ? 8 : undefined} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isSignup ? "At least 8 characters" : "Your password"} /></label>
            {isSignup && <label className="auth-label" htmlFor="confirm-password">Confirm password<input id="confirm-password" name="confirm-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Re-enter your password" /></label>}
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? "Please wait…" : isSignup ? "Create account" : "Sign in"}<span aria-hidden="true">→</span></button>
          </form>
          <p className="auth-switch">{isSignup ? "Already registered?" : "New to PatrolDesk?"} <Link href={isSignup ? "/login" : "/signup"}>{isSignup ? "Sign in" : "Create an account"}</Link></p>
          <p className="auth-legal">By continuing, you agree to follow department policy and keep your account credentials private.</p>
        </div>
      </section>
    </main>
  );
}