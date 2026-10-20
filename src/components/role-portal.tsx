"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, GraduationCap, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";

type PortalRole = "FTO" | "SUPERVISOR";
type Account = {
  username: string;
  accountType: "EMPLOYEE" | "FTO" | "HR";
  accountStatus: "ACTIVE" | "PENDING_APPROVAL" | "SUSPENDED";
  ftoApproved: boolean;
  supervisorApproved: boolean;
};

export function RolePortal({ role }: { role: PortalRole }) {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [checking, setChecking] = useState(true);
  const [failed, setFailed] = useState(false);
  const hasAccess = role === "FTO" ? account?.ftoApproved : account?.supervisorApproved;

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/me").then(async (response) => {
      if (!response.ok) {
        router.replace("/login");
        return null;
      }
      return response.json() as Promise<Account>;
    }).then((currentAccount) => {
      if (active && currentAccount) setAccount(currentAccount);
    }).catch(() => {
      if (active) setFailed(true);
    }).finally(() => {
      if (active) setChecking(false);
    });
    return () => { active = false; };
  }, [router]);

  if (checking) return <main className="auth-loading">Checking portal access…</main>;
  if (!account) return <main className="auth-pending"><h1>Could not verify access</h1><p>{failed ? "Reload the page and try again." : "Sign in to continue."}</p><Link className="access-back-link" href="/">Employee portal</Link></main>;
  if (!hasAccess) return <main className="auth-pending"><span className="pending-mark"><ShieldCheck size={22} /></span><span className="auth-kicker">{role} PORTAL</span><h1>Access not approved</h1><p>Submit an access request from the employee portal. HR must approve it before this workspace unlocks.</p><Link className="access-back-link" href="/">Return to employee portal</Link></main>;

  const title = role === "FTO" ? "Field training" : "Supervision";
  const Icon = role === "FTO" ? GraduationCap : Users;
  const description = role === "FTO"
    ? "Training assignments and employee progress will appear here."
    : "Supervisor assignments and team oversight will appear here.";

  return (
    <main className="role-portal-shell">
      <header className="role-portal-topbar"><Link href="/" className="role-portal-brand"><span className="brand-mark"><ShieldCheck size={18} /></span>patroldesk</Link><Link className="role-portal-back" href="/"><ArrowLeft size={15} /> Employee portal</Link><span className="role-portal-user">{account.username} · {role}</span></header>
      <section className="role-portal-content">
        <div className="role-portal-eyebrow">WESTBRIDGE PUBLIC SAFETY / {role}</div><h1><Icon size={27} /> {title} portal</h1><p className="role-portal-intro">{description}</p>
        <div className="role-portal-empty"><span className="pending-mark"><Icon size={22} /></span><b>{role} access is active</b><span>This portal is separate from your employee workspace. Role-specific tools can be added here.</span></div>
      </section>
    </main>
  );
}