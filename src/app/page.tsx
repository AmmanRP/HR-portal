"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Activity, ArrowDownToLine, Bell, ChevronDown, ClipboardList, Clock3, Command, FileText, Fingerprint, Gauge, Menu, Search, Shield, ShieldCheck, Siren, Users, X } from "lucide-react";
import { departments, type DepartmentName } from "@/lib/policy";
import { AccessRequestCard } from "@/components/access-request-card";

const roster = [
  { name: "D. Eady", rank: "Sergeant", department: "K9", badge: "0974", status: "On duty", time: "02:41:18", color: "olive", initials: "DE" },
  { name: "Morgan Hayes", rank: "Police 2", department: "Police", badge: "1048", status: "On duty", time: "01:18:04", color: "blue", initials: "MH" },
  { name: "Riley Carter", rank: "Probationary", department: "Fire", badge: "2186", status: "On duty", time: "00:52:39", color: "orange", initials: "RC" },
  { name: "Avery Brooks", rank: "EMT", department: "EMS", badge: "3371", status: "Off duty", time: "Yesterday", color: "rose", initials: "AB" },
  { name: "Jordan Lee", rank: "Traffic Officer", department: "DOT", badge: "4512", status: "Off duty", time: "Yesterday", color: "slate", initials: "JL" },
  { name: "Sam Rivera", rank: "Detective", department: "Detective", badge: "5289", status: "On duty", time: "00:34:12", color: "teal", initials: "SR" },
];

const nav = [
  { label: "Overview", icon: Gauge },
  { label: "Personnel", icon: Users },
  { label: "Duty log", icon: Clock3 },
  { label: "Applications", icon: ClipboardList, count: "4" },
  { label: "Reports", icon: FileText },
];

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
  const [checkingAccount, setCheckingAccount] = useState(true);
  const [activeNav, setActiveNav] = useState("Overview");
  const [department, setDepartment] = useState("All departments");
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => {
    let active = true;
    void fetch("/api/auth/me").then(async (response) => {
      if (!response.ok) {
        router.replace("/login");
        return null;
      }
      return response.json() as Promise<SignedInAccount>;
    }).then((signedInAccount) => {
      if (active && signedInAccount) setAccount(signedInAccount);
    }).catch(() => router.replace("/login")).finally(() => {
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

  const visibleRoster = roster.filter((person) => {
    const matchesDepartment = department === "All departments" || person.department === department;
    const query = search.toLowerCase();
    return matchesDepartment && `${person.name} ${person.rank} ${person.department} ${person.badge}`.toLowerCase().includes(query);
  });

  return (
    <main className="shell">
      {sidebarOpen && <button aria-label="Close menu" className="scrim" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand"><span className="brand-mark"><ShieldCheck size={19} /></span><span>patrol<span className="brand-light">desk</span></span><button className="mobile-close" aria-label="Close menu" onClick={() => setSidebarOpen(false)}><X size={18} /></button></div>
        <div className="agency"><span className="agency-seal"><Siren size={17} /></span><span><b>WESTBRIDGE</b><small>PUBLIC SAFETY</small></span><ChevronDown size={14} className="agency-chevron" /></div>
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
          {departments.slice(0, 6).map((name, index) => <button key={name} className="department-link" onClick={() => { setDepartment(name === "Admin / HR" ? "All departments" : name); setActiveNav("Personnel"); }}><span className={`dept-dot dot-${index}`} />{name === "Admin / HR" ? "Administration" : name}<span className="department-size">{[18, 12, 9, 7, 6, 5][index]}</span></button>)}
        </div>
        <div className="sidebar-spacer" />
        <div className="sidebar-status"><span className="online-dot" /><span>Systems operational</span><span className="status-version">v0.1</span></div>
        <button className="profile-button" onClick={signOut} aria-label="Sign out"><span className="profile-avatar">{account.username.slice(0, 2).toUpperCase()}</span><span className="profile-copy"><b>{account.username}</b><small>{account.accountType === "HR" ? "Human Resources" : account.accountType === "FTO" ? "Field Training Officer" : "Employee"}</small></span><ChevronDown size={15} /></button>
      </aside>

      <section className="workspace">
        <header className="topbar"><button className="mobile-menu" aria-label="Open menu" onClick={() => setSidebarOpen(true)}><Menu size={19} /></button><div className="breadcrumb">Operations <span>/</span> <b>{activeNav}</b></div><div className="topbar-actions"><div className="system-live"><span className="online-dot" />LIVE SYSTEM</div><button className="icon-button notification" aria-label="Notifications"><Bell size={17} /><i /></button><span className="top-divider" /><span className="current-date">MON, OCT 19 <b>2026</b></span><span className="top-avatar">AD</span></div></header>

        <div className="page-content">
          <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> MONDAY BRIEFING <span className="eyebrow-date">OCT 19, 2026</span></div><h1>Good morning, {account.username}<span>.</span></h1><p>Here’s the department picture as the day gets underway.</p></div><button className="export-button"><ArrowDownToLine size={15} /> Export report</button></div>

          <section className="stats-grid" aria-label="Department summary">
            <article className="stat-card stat-dark"><div className="stat-head"><span>ON DUTY NOW</span><span className="stat-icon"><Activity size={17} /></span></div><div className="stat-value">08<span> / 57</span></div><div className="stat-foot"><span className="stat-bar"><i style={{ width: "24%" }} /></span><span>14% of roster</span></div></article>
            <article className="stat-card"><div className="stat-head"><span>OPEN APPLICATIONS</span><span className="stat-icon warm"><ClipboardList size={17} /></span></div><div className="stat-value">04</div><div className="stat-foot"><span className="attention-text">2 awaiting interview</span><span className="stat-arrow">↗</span></div></article>
            <article className="stat-card"><div className="stat-head"><span>HOURS THIS WEEK</span><span className="stat-icon green"><Clock3 size={17} /></span></div><div className="stat-value">126<span className="stat-unit">h</span></div><div className="stat-foot"><span className="positive-change">+12%</span><span>compared to last week</span></div></article>
            <article className="stat-card"><div className="stat-head"><span>REVIEW REQUIRED</span><span className="stat-icon red"><Fingerprint size={17} /></span></div><div className="stat-value">03</div><div className="stat-foot"><span>Shift notes &amp; activity flags</span><span className="review-dot" /></div></article>
          </section>

          <AccessRequestCard ftoApproved={account.ftoApproved} supervisorApproved={account.supervisorApproved} />

          <section className="roster-section">
            <div className="section-heading"><div><div className="section-kicker">FIELD STATUS <span className="live-pill"><i /> LIVE</span></div><h2>Personnel roster</h2></div><button className="view-link" onClick={() => setActiveNav("Personnel")}>View all personnel <span>→</span></button></div>
            <div className="table-toolbar"><div className="table-tabs"><button className="tab-active">All personnel <span>57</span></button><button>On duty <span>8</span></button><button>Off duty <span>49</span></button></div><div className="table-controls"><label className="search-box"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search personnel" /></label><select className="filter-select" aria-label="Filter by department" value={department} onChange={(event) => setDepartment(event.target.value)}><option>All departments</option>{departments.map((value) => <option key={value} value={value}>{value}</option>)}</select></div></div>
            <div className="roster-scroll"><table className="roster-table"><thead><tr><th>PERSONNEL</th><th>DEPARTMENT</th><th>BADGE / CALLSIGN</th><th>STATUS</th><th>SHIFT TIME</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visibleRoster.map((person) => <tr key={person.badge}><td><div className="person-cell"><span className={`person-avatar avatar-${person.color}`}>{person.initials}</span><span><b>{person.name}</b><small>{person.rank}</small></span></div></td><td><span className="department-cell"><span className={`table-dot dot-${departments.indexOf(person.department as DepartmentName)}`} />{person.department}</span></td><td><span className="badge-number">{person.badge}</span><span className="callsign">{person.rank} | {person.name.split(" ").at(-1)} {person.department}</span></td><td><span className={`duty-status ${person.status === "On duty" ? "duty-on" : "duty-off"}`}><i />{person.status}</span></td><td className="shift-time">{person.time}</td><td><button className="row-more" aria-label={`More actions for ${person.name}`}>···</button></td></tr>)}</tbody></table>{visibleRoster.length === 0 && <div className="empty-state">No personnel match this search.</div>}</div>
            <div className="table-footer"><span>Showing <b>{visibleRoster.length}</b> of <b>57</b> personnel</span><div className="pagination"><button disabled aria-label="Previous page">‹</button><button className="page-current">1</button><button>2</button><button>3</button><span>…</span><button>6</button><button aria-label="Next page">›</button></div></div>
          </section>

          <div className="bottom-grid"><section className="activity-panel"><div className="panel-heading"><div><div className="section-kicker">RECENT UPDATES</div><h2>Activity</h2></div><button className="panel-more" aria-label="More activity">···</button></div><div className="activity-list"><div className="activity-item"><span className="activity-icon activity-clock"><Clock3 size={15} /></span><span className="activity-copy"><b>Morgan Hayes</b> clocked in to Police<span>Police 2 · Signed shift acknowledgement</span></span><time>4m ago</time></div><div className="activity-item"><span className="activity-icon activity-file"><ClipboardList size={15} /></span><span className="activity-copy"><b>New application</b> received<span>Fire Department · Riley Carter</span></span><time>26m ago</time></div><div className="activity-item"><span className="activity-icon activity-check"><Shield size={15} /></span><span className="activity-copy"><b>Shift report submitted</b><span>K9 Unit · Sgt. D. Eady</span></span><time>1h ago</time></div></div></section><section className="shift-panel"><div className="panel-heading"><div><div className="section-kicker">YOUR STATUS</div><h2>Duty shift</h2></div><span className="shift-indicator"><i /> OFF DUTY</span></div><div className="shift-empty"><span className="shift-clock"><Clock3 size={22} /></span><b>Your next shift starts here</b><span>Clock in with your signed acknowledgement to begin tracking duty time.</span><button onClick={() => setActiveNav("Duty log")} className="clock-button"><Fingerprint size={16} /> Go to duty log</button></div></section></div>
          <footer className="page-footer"><span><Command size={12} /> PATROLDESK OPERATIONS</span><span>All times shown in local system time · Activity subject to supervisor review</span><button>Privacy &amp; records</button></footer>
        </div>
      </section>
    </main>
  );
}