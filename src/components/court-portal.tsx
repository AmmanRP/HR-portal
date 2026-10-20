"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, CalendarDays, Check, ChevronRight, Clock3, FilePlus2, Gavel, Scale, ShieldCheck, Users } from "lucide-react";

type CourtRole = "OFFICER" | "SUSPECT" | "ATTORNEY" | "WITNESS" | "JUDGE";
type Profile = { id: string; role: CourtRole; characterName: string; fictionalSsn: string; birthDate: string; address: string; height: string };
type CourtCase = {
  id: string;
  caseNumber: string;
  defendantName: string;
  stateCode: string;
  charge: string;
  classification: string;
  summary: string;
  status: "FILED" | "SCHEDULED" | "IN_TRIAL" | "RESOLVED" | "DISMISSED";
  scheduledAt: string | null;
  plea: "GUILTY" | "NOT_GUILTY" | null;
  outcome: "GUILTY" | "NOT_GUILTY" | "DISMISSED" | null;
  filedBy: { characterName: string; employee: { username: string; badgeNumber: string | null } };
  evidence: { id: string; label: string; description: string; submittedBy: { characterName: string } }[];
  participants: { id: string; role: CourtRole; profile: { characterName: string } }[];
  events: { id: string; action: string; details: string; createdAt: string; actor: { characterName: string } }[];
};

const roles: { id: CourtRole; title: string; note: string }[] = [
  { id: "SUSPECT", title: "Suspect / defendant", note: "View charges, plead, and attend court" },
  { id: "OFFICER", title: "Law enforcement", note: "Requires a law-enforcement department assignment" },
  { id: "ATTORNEY", title: "Attorney", note: "Join a client's open case" },
  { id: "WITNESS", title: "Witness", note: "Join an open case as a witness" },
  { id: "JUDGE", title: "Judge", note: "Requires a Judge department assignment" },
];

function friendlyStatus(status: CourtCase["status"]) {
  return status.replace("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isReadyForOutcome(courtCase: CourtCase) {
  const officerJoined = courtCase.participants.some((participant) => participant.role === "OFFICER");
  const suspectJoined = courtCase.participants.some((participant) => participant.role === "SUSPECT");
  const witnessJoined = courtCase.participants.some((participant) => participant.role === "WITNESS");
  return courtCase.status === "IN_TRIAL" && Boolean(courtCase.plea) && officerJoined && suspectJoined && (courtCase.evidence.length > 0 || witnessJoined);
}

export function CourtPortal() {
  const router = useRouter();
  const [account, setAccount] = useState<{ username: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [cases, setCases] = useState<CourtCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeTab, setActiveTab] = useState<"cases" | "file">("cases");
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<CourtRole>("SUSPECT");
  const [profileForm, setProfileForm] = useState({ characterName: "", fictionalSsn: "", birthDate: "", address: "", height: "" });
  const [chargeForm, setChargeForm] = useState({ defendantName: "", stateCode: "", charge: "", classification: "MISDEMEANOR", summary: "" });
  const [selectedCase, setSelectedCase] = useState<string | null>(null);
  const [benchNoteCase, setBenchNoteCase] = useState<string | null>(null);
  const [caseLookup, setCaseLookup] = useState("");
  const [evidenceForm, setEvidenceForm] = useState({ label: "", description: "" });
  const [scheduledAt, setScheduledAt] = useState("");

  const reload = useCallback(async () => {
    const response = await fetch("/api/court", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Could not load court records.");
    setProfile(data.profile as Profile | null);
    setCases(data.cases as CourtCase[]);
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/me").then(async (response) => {
      if (!response.ok) {
        router.replace("/login");
        return null;
      }
      const current = await response.json() as { username: string };
      if (active) setAccount(current);
      const courtResponse = await fetch("/api/court", { cache: "no-store" });
      const data = await courtResponse.json();
      if (!courtResponse.ok) throw new Error(data.error ?? "Could not load court records.");
      if (active) {
        setProfile(data.profile as Profile | null);
        setCases(data.cases as CourtCase[]);
      }
      return current;
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : "Could not load court records.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [router]);

  useEffect(() => {
    if (!profile) return;
    const timer = window.setInterval(() => {
      void reload().catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "Could not refresh court records.");
      });
    }, 20000);
    return () => window.clearInterval(timer);
  }, [profile, reload]);

  const activeCases = useMemo(() => cases.filter((courtCase) => !["RESOLVED", "DISMISSED"].includes(courtCase.status)), [cases]);
  const visibleCases = useMemo(() => {
    const query = caseLookup.trim().toLowerCase();
    if (profile?.role !== "ATTORNEY" && profile?.role !== "WITNESS") return cases;
    if (!query) return [];
    return cases.filter((courtCase) => profile.role === "ATTORNEY"
      ? courtCase.defendantName.toLowerCase().includes(query)
      : `${courtCase.filedBy.characterName} ${courtCase.filedBy.employee.username} ${courtCase.filedBy.employee.badgeNumber ?? ""}`.toLowerCase().includes(query));
  }, [caseLookup, cases, profile]);
  const nextCourtDate = activeCases.find((courtCase) => courtCase.scheduledAt)?.scheduledAt;

  async function postJson(url: string, payload: unknown) {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "The court action could not be completed.");
    return result;
  }

  async function handleProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await withBusy(async () => {
      await postJson("/api/court/profile", { ...profileForm, role });
      await reload();
      setNotice("Your roleplay character profile is ready.");
    });
  }

  async function handleCharge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await withBusy(async () => {
      const result = await postJson("/api/court/cases", chargeForm) as { case: CourtCase };
      await reload();
      setActiveTab("cases");
      setNotice(`Charge filed as case ${result.case.caseNumber}.`);
      setChargeForm({ defendantName: "", stateCode: "", charge: "", classification: "MISDEMEANOR", summary: "" });
    });
  }

  async function withBusy(action: () => Promise<void>) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await action();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "The action could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  async function caseAction(courtCase: CourtCase, payload: unknown, successMessage: string) {
    await withBusy(async () => {
      await postJson(`/api/court/cases/${courtCase.id}/actions`, payload);
      await reload();
      setNotice(successMessage);
      setSelectedCase(null);
    });
  }

  if (loading) return <main className="auth-loading">Opening the courthouse…</main>;
  if (!account) return null;

  return (
    <main className="court-shell">
      <header className="court-topbar">
        <Link href="/" className="court-brand"><span className="brand-mark"><ShieldCheck size={18} /></span>patroldesk <span className="court-brand-divider">/</span> COURT</Link>
        <Link href="/" className="court-back"><ArrowLeft size={15} /> Operations portal</Link>
        <span className="court-account">{account.username}</span>
      </header>
      <section className="court-content">
        <div className="court-heading">
          <div><div className="court-eyebrow"><Scale size={14} /> WESTBRIDGE ROLEPLAY COURT</div><h1>Courthouse <span>portal</span></h1><p>Charges, court sessions, evidence, and case updates in one place.</p></div>
          <div className="court-heading-tag"><Gavel size={17} /> IN-GAME CASES ONLY</div>
        </div>
        {error && <div className="court-message court-error" role="alert">{error}<button onClick={() => { setError(""); void reload().catch((reloadError: unknown) => setError(reloadError instanceof Error ? reloadError.message : "Could not reload.")); }}>Retry</button></div>}
        {notice && <div className="court-message court-success" role="status"><Check size={15} /> {notice}</div>}

        {!profile ? (
          <section className="court-setup">
            <div className="court-panel-title"><span className="court-step">01</span><div><span className="court-overline">CHARACTER REGISTRATION</span><h2>Create your court profile</h2></div></div>
            <p className="court-disclaimer">Enter roleplay character details only. The 9-digit number is a made-up in-game identifier, never a real SSN. Do not enter real personal information.</p>
            <form className="court-form court-profile-form" onSubmit={(event) => void handleProfile(event)}>
              <label className="court-field court-field-wide">Court role<select value={role} onChange={(event) => setRole(event.target.value as CourtRole)}>{roles.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><small>{roles.find((item) => item.id === role)?.note}</small></label>
              <label className="court-field">Character name<input required minLength={2} maxLength={60} value={profileForm.characterName} onChange={(event) => setProfileForm({ ...profileForm, characterName: event.target.value })} placeholder="e.g. Daniel Eady" /></label>
              <label className="court-field">Fictional in-game ID<input required inputMode="numeric" pattern="[0-9]{9}" maxLength={9} value={profileForm.fictionalSsn} onChange={(event) => setProfileForm({ ...profileForm, fictionalSsn: event.target.value.replace(/\D/g, "").slice(0, 9) })} placeholder="9 digits — not a real SSN" /><small>Invent any unused 9-digit number.</small></label>
              <label className="court-field">Character birth date<input required type="date" value={profileForm.birthDate} onChange={(event) => setProfileForm({ ...profileForm, birthDate: event.target.value })} /></label>
              <label className="court-field">In-game address<input required minLength={3} maxLength={120} value={profileForm.address} onChange={(event) => setProfileForm({ ...profileForm, address: event.target.value })} placeholder="Fictional street and city" /></label>
              <label className="court-field">Character height<input required maxLength={20} value={profileForm.height} onChange={(event) => setProfileForm({ ...profileForm, height: event.target.value })} placeholder={'e.g. 5\'10"'} /></label>
              <button className="court-primary court-field-wide" disabled={busy}>{busy ? "Saving profile…" : "Create roleplay profile"} <ChevronRight size={16} /></button>
            </form>
          </section>
        ) : (
          <>
            <section className="court-summary">
              <article className="court-summary-card"><span>YOUR CHARACTER</span><b>{profile.characterName}</b><small>{profile.role} · In-game only</small></article>
              <article className="court-summary-card"><span>ACTIVE CASES</span><b>{activeCases.length.toString().padStart(2, "0")}</b><small>Cases requiring attention</small></article>
              <article className="court-summary-card court-summary-next"><span>NEXT COURT DATE</span><b>{nextCourtDate ? new Date(nextCourtDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Not scheduled"}</b><small>{nextCourtDate ? new Date(nextCourtDate).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "A judge will set a date"}</small></article>
            </section>
            <div className="court-workspace">
              <section className="court-main-panel">
                <div className="court-tabs"><button className={activeTab === "cases" ? "court-tab-active" : ""} onClick={() => setActiveTab("cases")}><Scale size={15} /> Cases <span>{cases.length}</span></button>{profile.role === "OFFICER" && <button className={activeTab === "file" ? "court-tab-active" : ""} onClick={() => setActiveTab("file")}><FilePlus2 size={15} /> File a charge</button>}</div>
                {activeTab === "file" && profile.role === "OFFICER" ? (
                  <form className="court-form court-charge-form" onSubmit={(event) => void handleCharge(event)}>
                    <div className="court-panel-title"><span className="court-step">02</span><div><span className="court-overline">LAW ENFORCEMENT</span><h2>File a new charge</h2></div></div>
                    <p className="court-form-note">This creates a roleplay case record and notifies the named character when they register their profile.</p>
                    <label className="court-field">Suspect character name<input required maxLength={60} value={chargeForm.defendantName} onChange={(event) => setChargeForm({ ...chargeForm, defendantName: event.target.value })} placeholder="Name exactly as shown in-game" /></label>
                    <div className="court-form-row"><label className="court-field">State code<input required maxLength={24} value={chargeForm.stateCode} onChange={(event) => setChargeForm({ ...chargeForm, stateCode: event.target.value })} placeholder="e.g. WB § 12-4" /></label><label className="court-field">Charge<input required maxLength={80} value={chargeForm.charge} onChange={(event) => setChargeForm({ ...chargeForm, charge: event.target.value })} placeholder="e.g. Theft" /></label></div>
                    <label className="court-field">Charge class<select value={chargeForm.classification} onChange={(event) => setChargeForm({ ...chargeForm, classification: event.target.value })}><option value="MISDEMEANOR">Misdemeanor</option><option value="FELONY">Felony</option><option value="INFRACTION">Infraction</option></select></label>
                    <label className="court-field">Incident summary<textarea required minLength={8} maxLength={1200} rows={4} value={chargeForm.summary} onChange={(event) => setChargeForm({ ...chargeForm, summary: event.target.value })} placeholder="Record the roleplay incident facts." /></label>
                    <button className="court-primary" disabled={busy}>{busy ? "Filing…" : "Submit charge"} <ChevronRight size={16} /></button>
                  </form>
                ) : (
                  <div className="court-case-list">
                    <div className="court-list-heading"><div><span className="court-overline">CASE DOCKET</span><h2>{profile.role === "JUDGE" ? "All court cases" : profile.role === "ATTORNEY" || profile.role === "WITNESS" ? "Open cases" : "Your cases"}</h2></div><span className="court-case-count">{cases.length} RECORDS</span></div>
                    {(profile.role === "ATTORNEY" || profile.role === "WITNESS") && <label className="court-field court-lookup">{profile.role === "ATTORNEY" ? "Find your client by character name" : "Find the arresting officer by character name or account"}<input value={caseLookup} onChange={(event) => setCaseLookup(event.target.value)} placeholder={profile.role === "ATTORNEY" ? "Enter client character name" : "Enter officer name or account"} /></label>}
                    {cases.length === 0 || visibleCases.length === 0 ? <div className="court-empty"><span className="court-empty-icon"><Scale size={21} /></span><b>{cases.length === 0 ? "No cases yet" : "No matching cases"}</b><p>{profile.role === "OFFICER" ? "File a charge to create your first court case." : profile.role === "ATTORNEY" || profile.role === "WITNESS" ? "Enter a client or officer name to find the roleplay case." : "Cases associated with your character will appear here."}</p>{profile.role === "OFFICER" && <button className="court-primary" onClick={() => setActiveTab("file")}>File a charge <ChevronRight size={15} /></button>}</div> : visibleCases.map((courtCase) => (
                      <article className="court-case-card" key={courtCase.id}>
                        <div className="court-case-head"><div><span className="court-case-number">{courtCase.caseNumber}</span><span className={`court-status court-status-${courtCase.status.toLowerCase()}`}>{friendlyStatus(courtCase.status)}</span></div><span className="court-case-class">{courtCase.classification}</span></div>
                        <h3>{courtCase.charge} <span>· {courtCase.stateCode}</span></h3>
                        <div className="court-case-meta"><span><Users size={13} /> Defendant: {courtCase.defendantName}</span><span><ShieldCheck size={13} /> Officer: {courtCase.filedBy.characterName}{courtCase.filedBy.employee.badgeNumber ? ` · #${courtCase.filedBy.employee.badgeNumber}` : ""}</span></div>
                        {profile.role === "SUSPECT" && courtCase.defendantName.toLowerCase() === profile.characterName.toLowerCase() && <div className="court-character-details"><span>CHARACTER BIRTH DATE <b>{new Date(profile.birthDate).toLocaleDateString()}</b></span><span>FICTIONAL IN-GAME ID <b>{profile.fictionalSsn}</b></span></div>}
                        <p className="court-case-summary">{courtCase.summary}</p>
                        {courtCase.scheduledAt && <div className="court-date"><CalendarDays size={15} /><b>{new Date(courtCase.scheduledAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</b><span>COURT SESSION</span></div>}
                        <div className="court-case-detail">
                          <div className="court-evidence"><b>Evidence & witnesses <span>{courtCase.evidence.length}</span></b>{courtCase.evidence.length ? courtCase.evidence.map((item) => <div className="court-evidence-item" key={item.id}><strong>{item.label}</strong><p>{item.description}</p><small>Submitted by {item.submittedBy.characterName}</small></div>) : <small>No evidence has been submitted.</small>}</div>
                          {courtCase.plea && <div className="court-plea">PLEA ENTERED <b>{courtCase.plea.replace("_", " ")}</b></div>}
                          {courtCase.outcome && <div className="court-outcome"><BadgeCheck size={16} /> Final roleplay outcome: <b>{courtCase.outcome.replace("_", " ")}</b></div>}
                          <div className="court-participants"><b>Session participants</b>{courtCase.participants.length ? courtCase.participants.map((participant) => <span key={participant.id}>{participant.profile.characterName} · {participant.role.toLowerCase()}</span>) : <small>No one has joined the session yet.</small>}</div>
                        </div>
                        <div className="court-actions">
                          {!["RESOLVED", "DISMISSED"].includes(courtCase.status) && <button onClick={() => setBenchNoteCase(benchNoteCase === courtCase.id ? null : courtCase.id)}><Gavel size={14} /> {benchNoteCase === courtCase.id ? "Hide bench note" : "Simulate bench note"}</button>}
                          {!courtCase.participants.some((participant) => participant.role === profile.role && participant.profile.characterName === profile.characterName) && !["RESOLVED", "DISMISSED"].includes(courtCase.status) && <button onClick={() => void caseAction(courtCase, { action: "JOIN", ...((profile.role === "ATTORNEY") ? { targetName: courtCase.defendantName } : profile.role === "WITNESS" ? { targetName: courtCase.filedBy.characterName } : {}) }, "You joined the case session.")}><Users size={14} /> {profile.role === "ATTORNEY" ? "Join as counsel" : profile.role === "WITNESS" ? "Join as witness" : "Join case"}</button>}
                          {profile.role === "SUSPECT" && !courtCase.plea && !["RESOLVED", "DISMISSED"].includes(courtCase.status) && <><button onClick={() => void caseAction(courtCase, { action: "PLEA", plea: "GUILTY" }, "Your guilty plea was recorded.")}>Plead guilty</button><button onClick={() => void caseAction(courtCase, { action: "PLEA", plea: "NOT_GUILTY" }, "Your not-guilty plea was recorded.")}>Plead not guilty</button></>}
                          {profile.role === "OFFICER" && courtCase.status !== "RESOLVED" && courtCase.status !== "DISMISSED" && <button onClick={() => { setSelectedCase(courtCase.id); setEvidenceForm({ label: "", description: "" }); }}><FilePlus2 size={14} /> Add evidence</button>}
                          {profile.role === "JUDGE" && !["RESOLVED", "DISMISSED"].includes(courtCase.status) && <button onClick={() => { setSelectedCase(courtCase.id); setScheduledAt(""); }}><CalendarDays size={14} /> Schedule court</button>}
                          {profile.role === "JUDGE" && !["RESOLVED", "DISMISSED"].includes(courtCase.status) && isReadyForOutcome(courtCase) && <button onClick={() => { if (window.confirm(`Record a guilty roleplay outcome for ${courtCase.caseNumber}?`)) void caseAction(courtCase, { action: "VERDICT", outcome: "GUILTY" }, "Guilty outcome recorded."); }}>Record guilty</button>}
                          {profile.role === "JUDGE" && !["RESOLVED", "DISMISSED"].includes(courtCase.status) && isReadyForOutcome(courtCase) && <button onClick={() => { if (window.confirm(`Record a not-guilty roleplay outcome for ${courtCase.caseNumber}?`)) void caseAction(courtCase, { action: "VERDICT", outcome: "NOT_GUILTY" }, "Not-guilty outcome recorded."); }}>Record not guilty</button>}
                          {profile.role === "JUDGE" && !["RESOLVED", "DISMISSED"].includes(courtCase.status) && isReadyForOutcome(courtCase) && <button onClick={() => { if (window.confirm(`Dismiss roleplay case ${courtCase.caseNumber}?`)) void caseAction(courtCase, { action: "VERDICT", outcome: "DISMISSED" }, "Case marked dismissed."); }}>Dismiss case</button>}
                        </div>
                        {profile.role === "JUDGE" && !["RESOLVED", "DISMISSED"].includes(courtCase.status) && !isReadyForOutcome(courtCase) && <p className="court-judge-gate">To record an outcome, the scheduled hearing must be live, the officer and defendant must join, a plea must be entered, and evidence or a witness must be on file.</p>}
                        {benchNoteCase === courtCase.id && <div className="court-bench-note"><b><Gavel size={14} /> Simulated roleplay bench note</b><p>Case {courtCase.caseNumber} concerns {courtCase.charge} ({courtCase.classification.toLowerCase()}) under {courtCase.stateCode}. The defendant&apos;s plea is {courtCase.plea?.toLowerCase().replace("_", " ") ?? "not yet entered"}. {courtCase.evidence.length ? `${courtCase.evidence.length} item(s) of evidence are on file; the participants should review and discuss them during the hearing.` : "No evidence has been filed yet; the officer should present supporting evidence at the hearing."} The defendant may respond and call joined witnesses. This generated roleplay prompt is not an AI opinion or verdict; only the Judge character may record the case outcome.</p></div>}
                        {selectedCase === courtCase.id && profile.role === "OFFICER" && <form className="court-inline-form" onSubmit={(event) => { event.preventDefault(); void caseAction(courtCase, { action: "EVIDENCE", ...evidenceForm }, "Evidence added to the case."); }}><label className="court-field">Evidence type or witness name<input required maxLength={80} value={evidenceForm.label} onChange={(event) => setEvidenceForm({ ...evidenceForm, label: event.target.value })} placeholder="Body camera, witness, report…" /></label><label className="court-field">Details / evidence reference<textarea required minLength={5} maxLength={1200} rows={3} value={evidenceForm.description} onChange={(event) => setEvidenceForm({ ...evidenceForm, description: event.target.value })} placeholder="Add a summary or a private evidence link." /></label><button className="court-primary" disabled={busy}>Save evidence <Check size={14} /></button></form>}
                        {selectedCase === courtCase.id && profile.role === "JUDGE" && <form className="court-inline-form court-inline-schedule" onSubmit={(event) => { event.preventDefault(); void caseAction(courtCase, { action: "SCHEDULE", scheduledAt: new Date(scheduledAt).toISOString() }, "Court session scheduled."); }}><label className="court-field">Court date and time<input type="datetime-local" required value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></label><button className="court-primary" disabled={busy}>Confirm date <Check size={14} /></button></form>}
                        <details className="court-history"><summary><Clock3 size={13} /> Case history <span>{courtCase.events.length}</span></summary>{courtCase.events.map((item) => <div className="court-history-item" key={item.id}><time>{new Date(item.createdAt).toLocaleString()}</time><b>{item.actor.characterName}</b><span>{item.details}</span></div>)}</details>
                      </article>
                    ))}
                  </div>
                )}
              </section>
              <aside className="court-aside">
                <section className="court-aside-card court-ai-card"><span className="court-aside-icon"><Gavel size={17} /></span><span className="court-overline">BENCH NOTES</span><h3>Simulated judge</h3><p>This roleplay portal records facts and pleas. It does not connect to an AI provider or issue automated verdicts. A judge character reviews the case and records the outcome.</p><span className="court-simulation-label">HUMAN-CONTROLLED OUTCOMES</span></section>
                <section className="court-aside-card"><span className="court-overline">COURTROOM FLOW</span><ol className="court-flow"><li><span>01</span><div><b>Officer files a charge</b><small>State code, classification, and incident facts</small></div></li><li><span>02</span><div><b>Judge schedules court</b><small>Every participant sees the same date</small></div></li><li><span>03</span><div><b>Everyone joins the case</b><small>Defendant, officer, counsel, and witnesses</small></div></li><li><span>04</span><div><b>Judge records an outcome</b><small>Guilty, not guilty, or dismissed</small></div></li></ol></section>
                <div className="court-data-note"><ShieldCheck size={15} /><span>Character records are fictional roleplay data. Never enter real SSNs, addresses, or personal documents.</span></div>
              </aside>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
