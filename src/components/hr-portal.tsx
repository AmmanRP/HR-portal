"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Clock3, ShieldCheck, UserRound, X } from "lucide-react";
import Link from "next/link";

type AccessRequest = {
  id: string;
  requestType: "FTO" | "SUPERVISOR";
  requestNote: string | null;
  createdAt: string;
  employee: { username: string; department: string | null; rank: string };
};

export function HrPortal() {
  const router = useRouter();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [username, setUsername] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  async function loadRequests() {
    const response = await fetch("/api/hr/access-requests");
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Could not load the HR review queue.");
    setRequests(result.requests);
  }

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/me").then(async (response) => {
      if (!response.ok) {
        router.replace("/login");
        return null;
      }
      return response.json();
    }).then(async (account) => {
      if (!active || !account) return;
      setUsername(account.username);
      if (account.accountType !== "HR" || account.accountStatus !== "ACTIVE") return;
      await loadRequests();
      if (active) setAuthorized(true);
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : "Could not load the HR portal.");
    }).finally(() => {
      if (active) setChecking(false);
    });
    return () => { active = false; };
  }, [router]);

  async function reviewRequest(requestId: string, decision: "APPROVE" | "DENY") {
    const reviewNote = notes[requestId]?.trim() ?? "";
    if (decision === "DENY" && !reviewNote) {
      setError("Add a brief review note before denying a request.");
      return;
    }
    setError("");
    setBusyId(requestId);
    try {
      const response = await fetch(`/api/hr/access-requests/${requestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reviewNote }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save the review.");
      await loadRequests();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Could not save the review.");
    } finally {
      setBusyId(null);
    }
  }

  if (checking) return <main className="auth-loading">Checking HR access…</main>;
  if (!authorized) return <main className="auth-pending"><span className="pending-mark"><ShieldCheck size={22} /></span><span className="auth-kicker">HR PORTAL</span><h1>Access restricted</h1><p>{username ? "This account does not have approved HR access." : "Sign in with an approved HR account to continue."}</p><Link className="access-back-link" href="/">Return to employee portal</Link></main>;

  return (
    <main className="role-portal-shell">
      <header className="role-portal-topbar"><Link href="/" className="role-portal-brand"><span className="brand-mark"><ShieldCheck size={18} /></span>patroldesk</Link><Link className="role-portal-back" href="/"><ArrowLeft size={15} /> Employee portal</Link><span className="role-portal-user">{username} · HR</span></header>
      <section className="role-portal-content">
        <div className="role-portal-eyebrow">HUMAN RESOURCES / ACCESS CONTROL</div><h1>Access review</h1><p className="role-portal-intro">Review employee requests for FTO and Supervisor portal access. Decisions are recorded with your account and review time.</p>
        <div className="role-portal-summary"><span><Clock3 size={15} /> {requests.length} pending {requests.length === 1 ? "request" : "requests"}</span><span><UserRound size={15} /> Reviewed by {username}</span></div>
        {error && <p className="hr-review-error" role="alert">{error}</p>}
        {requests.length === 0 ? <div className="role-portal-empty"><span className="pending-mark"><Check size={22} /></span><b>Review queue is clear</b><span>New FTO and Supervisor requests will appear here.</span></div> : <div className="hr-request-list">{requests.map((accessRequest) => <article className="hr-request" key={accessRequest.id}>
          <div className="hr-request-main"><span className={`hr-request-type ${accessRequest.requestType === "FTO" ? "hr-type-fto" : "hr-type-supervisor"}`}>{accessRequest.requestType}</span><div><h2>{accessRequest.employee.username}</h2><p>{accessRequest.employee.department ?? "Department not set"} · {accessRequest.employee.rank}</p></div><time>{new Date(accessRequest.createdAt).toLocaleDateString()}</time></div>
          {accessRequest.requestNote && <p className="hr-request-note">“{accessRequest.requestNote}”</p>}
          <label className="hr-review-label">Review note <textarea value={notes[accessRequest.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [accessRequest.id]: event.target.value }))} maxLength={500} placeholder="Required when denying; optional when approving" /></label>
          <div className="hr-review-actions"><button disabled={busyId !== null} className="hr-deny-button" onClick={() => void reviewRequest(accessRequest.id, "DENY")}><X size={14} /> Deny request</button><button disabled={busyId !== null} className="hr-approve-button" onClick={() => void reviewRequest(accessRequest.id, "APPROVE")}><Check size={14} /> Approve access</button></div>
        </article>)}</div>}
      </section>
    </main>
  );
}