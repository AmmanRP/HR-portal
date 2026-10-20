"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BadgeCheck, Clock3, ShieldCheck } from "lucide-react";

type RequestType = "FTO" | "SUPERVISOR";
type RequestStatus = "PENDING" | "APPROVED" | "DENIED";
type AccessRequest = { requestType: RequestType; status: RequestStatus; reviewNote: string | null };

export function AccessRequestCard({ ftoApproved, supervisorApproved }: { ftoApproved: boolean; supervisorApproved: boolean }) {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [error, setError] = useState("");
  const [sending, setSending] = useState<RequestType | null>(null);

  async function loadRequests() {
    const response = await fetch("/api/access-requests");
    if (!response.ok) throw new Error("Could not load your access requests.");
    const result = await response.json() as { requests: AccessRequest[] };
    setRequests(result.requests);
  }

  useEffect(() => {
    void loadRequests().catch((loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : "Could not load access requests.");
    });
  }, []);

  async function requestAccess(requestType: RequestType) {
    setError("");
    setSending(requestType);
    try {
      const response = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestType }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not submit your request.");
      await loadRequests();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not submit your request.");
    } finally {
      setSending(null);
    }
  }

  function latestStatus(requestType: RequestType) {
    return requests.find((request) => request.requestType === requestType)?.status;
  }

  function renderAccess(requestType: RequestType, title: string, approved: boolean) {
    const status = latestStatus(requestType);
    const portal = requestType === "FTO" ? "/fto" : "/supervisor";
    return (
      <article className="access-request-item" key={requestType}>
        <span className="access-request-icon">{approved ? <BadgeCheck size={17} /> : <ShieldCheck size={17} />}</span>
        <span className="access-request-copy"><b>{title} portal</b><small>{approved ? "Access approved by HR" : status === "PENDING" ? "Waiting for HR review" : status === "DENIED" ? "Request denied. You may request again." : "Request separate portal access"}</small></span>
        {approved ? <Link className="access-request-action access-open" href={portal}>Open <ArrowUpRight size={14} /></Link> : status === "PENDING" ? <span className="access-pending"><Clock3 size={13} /> Pending</span> : <button className="access-request-action" disabled={sending !== null} onClick={() => void requestAccess(requestType)}>{sending === requestType ? "Sending…" : "Request"}</button>}
      </article>
    );
  }

  return (
    <section className="access-request-panel">
      <div className="access-request-heading"><div><div className="section-kicker">ROLE ACCESS</div><h2>Your portals</h2></div><span>HR-reviewed</span></div>
      <div className="access-request-list">
        {renderAccess("FTO", "FTO", ftoApproved)}
        {renderAccess("SUPERVISOR", "Supervisor", supervisorApproved)}
      </div>
      {error && <p className="access-request-error" role="alert">{error}</p>}
    </section>
  );
}