"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Activity, ArrowDownToLine, Bell, ChevronDown, ClipboardList, Clock3, Command, FileText, Fingerprint, Gauge, Menu, Search, Shield, ShieldCheck, Siren, Users, X } from "lucide-react";
import { departments } from "@/lib/policy";
import { AccessRequestCard } from "@/components/access-request-card";

const nav = [
  { label: "Overview", icon: Gauge },
  { label: "Personnel", icon: Users },
  { label: "Duty log", icon: Clock3 },
  { label: "Applications", icon: ClipboardList },
  { label: "Reports", icon: FileText },
];

type DashboardData = {
  asOf: string;
  employees: {
    id: string;
    name: string;
    username: string;
    department: string | null;
    rank: string;
    badgeNumber: string | null;
    callsign: string | null;
    isActive: boolean;
    onDuty: boolean;
    lastClockInAt: string | null;
  }[];
  summary: {
    employeeCount: number;
    onDutyCount: number;
    applicationCount: number;
    weekHours: number;
    shiftsToReview: number;
    pendingAccessRequests: number;
    viewerOnDuty: boolean;
  };
  departmentCounts: { name: string; count: number }[];
  recentShifts: {
    id: string;
    name: string;
    department: string | null;
    rank: string;
    clockInAt: string;
    clockOutAt: string | null;
  }[];
};

type SignedInAccount = {
  username: string;
  accountType: "EMPLOYEE" | "FTO" | "HR";
  accountStatus: "ACTIVE" | "PENDING_APPROVAL" | "SUSPENDED";
  ftoApproved: boolean;
  supervisorApproved: boolean;
};

export default function Home() {
  const router = useRouter();
  const [account, setAccount] = useState<SignedInAccount | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashboardError, setDashboardError] = useState("");
  const [checkingAccount, setCheckingAccount] = useState(true);
  const [activeNav, setActiveNav] = useState("Overview");
  const [department, setDepartment] = useState("All departments");
  const [rosterStatus, setRosterStatus] = useState<"ALL" | "ON_DUTY" | "OFF_DUTY">("ALL");
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => {
    let active = true;
    void fetch("/api/auth/me").then(async (response) => {
      if (!response.ok) {
        router.replace("/login");
        return null;
      }
      const signedInAccount = await response.json() as SignedInAccount;
      if (active) setAccount(signedInAccount);
      const dashboardResponse = await fetch("/api/dashboard", { cache: "no-store" });
      const dashboardResult = await dashboardResponse.json();
      if (!dashboardResponse.ok) throw new Error(dashboardResult.error ?? "Dashboard data is unavailable.");
      if (active) setDashboard(dashboardResult as DashboardData);
      return signedInAccount;
    }).then((signedInAccount) => {
      if (active && !signedInAccount) router.replace("/login");
    }).catch((error: unknown) => {
      if (error instanceof Error) setDashboardError(error.message);
      else setDashboardError("Dashboard data is unavailable.");
    }).finally(() => {
      if (active) setCheckingAccount(false);
    });
    return () => { active = false; };
  }, [router]);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  if (checkingAccount) return <main className="auth-loading">Checking your account…</main>;
  if (!account) return null;
  if (account.accountType !== "EMPLOYEE" && account.accountStatus === "PENDING_APPROVAL") {
    return <main className="auth-pending"><span className="pending-mark"><ShieldCheck size={22} /></span><span className="auth-kicker">ACCESS REQUEST</span><h1>Pending approval</h1><p>Your {account.accountType === "FTO" ? "FTO" : "HR"} account request is recorded. An administrator must approve this access before you can enter the portal.</p><button className="auth-submit" onClick={signOut}>Sign out<span aria-hidden="true">→</span></button></main>;
  }

  const visibleRoster = (dashboard?.employees ?? []).filter((person) => {
    const matchesDepartment = department === "All departments" || person.department === department;
    const matchesStatus = rosterStatus === "ALL" || (rosterStatus === "ON_DUTY" ? person.onDuty : !person.onDuty);
    const query = search.toLowerCase();
    return matchesDepartment && matchesStatus && `${person.name} ${person.rank} ${person.department ?? "unassigned"} ${person.badgeNumber ?? ""} ${person.callsign ?? ""}`.toLowerCase().includes(query);
  });
  const displayDate = new Date(dashboard?.asOf ?? Date.now());

  return (
    <main className="shell">
      {sidebarOpen && <button aria-label="Close menu" className="scrim" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand"><span className="brand-mark"><ShieldCheck size={19} /></span><span>patrol<span className="brand-light">desk</span></span><button className="mobile-close" aria-label="Close menu" onClick={() => setSidebarOpen(false)}><X size={18} /></button></div>
        <div className="agency"><span className="agency-seal"><Siren size={17} /></span><span><b>PATROLDESK</b><small>OPERATIONS</small></span><ChevronDown size={14} className="agency-chevron" /></div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="nav-list" aria-label="Main navigation">
          {nav.map(({ label, icon: Icon, count }) => <button key={label} onClick={() => { setActiveNav(label); setSidebarOpen(false); }} className={`nav-item ${activeNav === label ? "nav-active" : ""}`}><Icon size={17} /><span>{label}</span>{count && <span className="nav-count">{count}</span>}</button>)}
        </nav>
        <div className="nav-label portal-switch-label">YOUR PORTALS</div>
        <nav className="nav-list" aria-label="Available portals">
          <Link className="nav-item portal-switch-link" href="/"><Users size={16} /><span>Employee portal</span></Link>
          {account.ftoApproved && <Link className="nav-item portal-switch-link" href="/fto"><ShieldCheck size={16} /><span>FTO portal</span></Link>}
          {account.supervisorApproved && <Link className="nav-item portal-switch-link" href="/supervisor"><Users size={16} /><span>Supervisor portal</span></Link>}
          {account.accountType === "HR" && account.accountStatus === "ACTIVE" && <Link className="nav-item portal-switch-link" href="/hr"><ShieldCheck size={16} /><span>HR portal</span></Link>}
        </nav>
        <div className="nav-label department-label">DEPARTMENTS <button aria-label="Add department">+</button></div>
        <div className="department-list">
          {departments.map((name, index) => <button key={name} className="department-link" onClick={() => { setDepartment(name === "Admin / HR" ? "All departments" : name); setActiveNav("Personnel"); }}><span className={`dept-dot dot-${index}`} />{name === "Admin / HR" ? "Administration" : name}<span className="department-size">{dashboard?.departmentCounts.find((item) => item.name === name)?.count ?? 0}</span></button>)}
        </div>
        <div className="sidebar-spacer" />
        <div className="sidebar-status">{dashboard ? <span className="online-dot" /> : <span className="review-dot" />}<span>{dashboard ? "Database connected" : dashboardError ? "Data unavailable" : "Loading data"}</span><span className="status-version">v0.2</span></div>
        <button className="profile-button" onClick={signOut} aria-label="Sign out"><span className="profile-avatar">{account.username.slice(0, 2).toUpperCase()}</span><span className="profile-copy"><b>{account.username}</b><small>{account.accountType === "HR" ? "Human Resources" : account.accountType === "FTO" ? "Field Training Officer" : "Employee"}</small></span><ChevronDown size={15} /></button>
      </aside>

      <section className="workspace">
        <header className="topbar"><button className="mobile-menu" aria-label="Open menu" onClick={() => setSidebarOpen(true)}><Menu size={19} /></button><div className="breadcrumb">Operations <span>/</span> <b>{activeNav}</b></div><div className="topbar-actions"><div className="system-live">{dashboard ? <span className="online-dot" /> : <span className="review-dot" />}{dashboard ? "DATABASE CONNECTED" : "DATA STATUS"}</div><span className="top-divider" /><span className="current-date">{displayDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "2-digit" }).toUpperCase()} <b>{displayDate.getFullYear()}</b></span><span className="top-avatar">{account.username.slice(0, 2).toUpperCase()}</span></div></header>

        <div className="page-content">
          <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> DEPARTMENT OPERATIONS <span className="eyebrow-date">{displayDate.toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" }).toUpperCase()}</span></div><h1>Welcome, {account.username}<span>.</span></h1><p>Personnel and duty records from your department database.</p></div><button className="export-button" onClick={() => window.print()}><ArrowDownToLine size={15} /> Print report</button></div>

          {dashboardError && <div className="dashboard-error" role="alert"><span>{dashboardError}</span><button onClick={() => window.location.reload()}>Retry</button></div>}

          <section className="stats-grid" aria-label="Department summary">
            <article className="stat-card stat-dark"><div className="stat-head"><span>ON DUTY NOW</span><span className="stat-icon"><Activity size={17} /></span></div><div className="stat-value">{dashboard?.summary.onDutyCount ?? "—"}<span> / {dashboard?.summary.employeeCount ?? "—"}</span></div><div className="stat-foot"><span>Open, server-timestamped shifts</span></div></article>
            <article className="stat-card"><div className="stat-head"><span>OPEN APPLICATIONS</span><span className="stat-icon warm"><ClipboardList size={17} /></span></div><div className="stat-value">{dashboard?.summary.applicationCount ?? "—"}</div><div className="stat-foot"><span>{dashboard ? "Awaiting review or interview" : "Database data unavailable"}</span></div></article>
            <article className="stat-card"><div className="stat-head"><span>DUTY HOURS THIS WEEK</span><span className="stat-icon green"><Clock3 size={17} /></span></div><div className="stat-value">{dashboard?.summary.weekHours ?? "—"}<span className="stat-unit">h</span></div><div className="stat-foot"><span>Calculated from duty shift records</span></div></article>
            <article className="stat-card"><div className="stat-head"><span>REVIEW REQUIRED</span><span className="stat-icon red"><Fingerprint size={17} /></span></div><div className="stat-value">{dashboard ? dashboard.summary.shiftsToReview + dashboard.summary.pendingAccessRequests : "—"}</div><div className="stat-foot"><span>{dashboard?.summary.shiftsToReview ?? 0} shifts · {account.accountType === "HR" ? dashboard?.summary.pendingAccessRequests ?? 0 : "HR-only"} access requests</span></div></article>
          </section>

          <AccessRequestCard ftoApproved={account.ftoApproved} supervisorApproved={account.supervisorApproved} />

          <section className="roster-section">
            <div className="section-heading"><div><div className="section-kicker">PERSONNEL RECORDS</div><h2>Personnel roster</h2></div></div>
            <div className="table-toolbar"><div className="table-tabs"><button className={rosterStatus === "ALL" ? "tab-active" : ""} onClick={() => setRosterStatus("ALL")}>All personnel <span>{dashboard?.summary.employeeCount ?? "—"}</span></button><button className={rosterStatus === "ON_DUTY" ? "tab-active" : ""} onClick={() => setRosterStatus("ON_DUTY")}>On duty <span>{dashboard?.summary.onDutyCount ?? "—"}</span></button><button className={rosterStatus === "OFF_DUTY" ? "tab-active" : ""} onClick={() => setRosterStatus("OFF_DUTY")}>Off duty <span>{dashboard ? Math.max(0, dashboard.summary.employeeCount - dashboard.summary.onDutyCount) : "—"}</span></button></div><div className="table-controls"><label className="search-box"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search personnel" /></label><select className="filter-select" aria-label="Filter by department" value={department} onChange={(event) => setDepartment(event.target.value)}><option>All departments</option>{departments.map((value) => <option key={value} value={value}>{value}</option>)}</select></div></div>
            <div className="roster-scroll"><table className="roster-table"><thead><tr><th>PERSONNEL</th><th>DEPARTMENT</th><th>BADGE / CALLSIGN</th><th>STATUS</th><th>LAST CLOCK-IN</th></tr></thead><tbody>{visibleRoster.map((person) => <tr key={person.id}><td><div className="person-cell"><span className="person-avatar avatar-slate">{person.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span><span><b>{person.name}</b><small>{person.rank}</small></span></div></td><td><span className="department-cell"><span className="table-dot" />{person.department ?? "Unassigned"}</span></td><td><span className="badge-number">{person.badgeNumber ?? "Not assigned"}</span><span className="callsign">{person.callsign ?? "Callsign pending"}</span></td><td><span className={`duty-status ${person.onDuty ? "duty-on" : "duty-off"}`}><i />{person.onDuty ? "On duty" : "Off duty"}</span></td><td className="shift-time">{person.lastClockInAt ? new Date(person.lastClockInAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "No shifts yet"}</td></tr>)}</tbody></table>{visibleRoster.length === 0 && <div className="empty-state">{dashboardError || (dashboard?.employees.length === 0 ? "No employee accounts are registered yet." : "No personnel match these filters.")}</div>}</div>
            <div className="table-footer"><span>Showing <b>{visibleRoster.length}</b> of <b>{dashboard?.summary.employeeCount ?? "—"}</b> employee records</span></div>
          </section>

          <div className="bottom-grid"><section className="activity-panel"><div className="panel-heading"><div><div className="section-kicker">DATABASE RECORDS</div><h2>Recent shifts</h2></div></div><div className="activity-list">{dashboard?.recentShifts.length ? dashboard.recentShifts.map((shift) => <div className="activity-item" key={shift.id}><span className="activity-icon activity-clock"><Clock3 size={15} /></span><span className="activity-copy"><b>{shift.name}</b>{shift.clockOutAt ? " completed a shift" : " started a shift"}<span>{shift.department ?? "Unassigned"} · {shift.rank} · {new Date(shift.clockInAt).toLocaleString()}</span></span><time>{shift.clockOutAt ? "Closed" : "Open"}</time></div>) : <div className="empty-state">{dashboardError || "No shift records have been created."}</div>}</div></section><section className="shift-panel"><div className="panel-heading"><div><div className="section-kicker">YOUR STATUS</div><h2>Duty shift</h2></div><span className={`shift-indicator ${dashboard?.summary.viewerOnDuty ? "shift-active" : ""}`}><i />{dashboard ? dashboard.summary.viewerOnDuty ? "ON DUTY" : "OFF DUTY" : "UNAVAILABLE"}</span></div><div className="shift-empty"><span className="shift-clock"><Clock3 size={22} /></span><b>{dashboard ? dashboard.summary.viewerOnDuty ? "You have an open shift" : "No open shift" : "Duty status unavailable"}</b><span>{dashboard ? "Status reflects your server-recorded duty shifts." : dashboardError || "Loading duty status."}</span></div></section></div>
          <footer className="page-footer"><span><Command size={12} /> PATROLDESK OPERATIONS</span><span>All times shown in local system time · Activity subject to supervisor review</span><button>Privacy &amp; records</button></footer>
        </div>
      </section>
    </main>
  );
}