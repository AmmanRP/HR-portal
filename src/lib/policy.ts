export const departments = [
  "Police",
  "Fire",
  "EMS",
  "DOT",
  "SWAT",
  "K9",
  "Judge",
  "CSI",
  "Detective",
  "Coroner",
  "Admin / HR",
] as const;

export type DepartmentName = (typeof departments)[number];

const ladders: Record<DepartmentName, string[]> = {
  Police: ["Probationary", "Police 1", "Police 2", "Police 3", "Corporal", "Sergeant", "Lieutenant", "Captain", "Deputy Chief", "Chief of Police"],
  Fire: ["Probationary", "Firefighter", "Fire Engineer", "Lieutenant", "Captain", "Battalion Chief", "Deputy Fire Marshal", "Fire Marshal"],
  EMS: ["Probationary", "EMT", "Advanced EMT", "Paramedic", "Field Supervisor", "EMS Chief"],
  DOT: ["Probationary", "Traffic Officer", "Senior Traffic Officer", "Traffic Supervisor", "DOT Chief"],
  SWAT: ["Probationary", "Operator", "Corporal", "Sergeant", "Team Leader", "Commander"],
  K9: ["Probationary", "Handler", "Corporal", "Sergeant", "K9 Supervisor"],
  Judge: ["Probationary", "Judge", "Senior Judge", "Chief Judge"],
  CSI: ["Probationary", "CSI Technician", "Senior CSI", "CSI Supervisor"],
  Detective: ["Probationary", "Detective", "Senior Detective", "Detective Supervisor"],
  Coroner: ["Probationary", "Coroner", "Senior Coroner", "Chief Coroner"],
  "Admin / HR": ["Probationary", "HR Officer", "HR Supervisor", "Director of HR"],
};

export function getRankLadder(department: DepartmentName) {
  return ladders[department];
}

export function applicationRequirement(department: DepartmentName) {
  if (department === "DOT") return "No prior experience required";
  if (department === "K9" || department === "SWAT") return "Corporal eligibility required";
  if (department === "Police" || department === "Fire" || department === "EMS") return "Prior department experience required";
  return "Three weeks of roleplay experience required";
}

export function meetsApplicationRequirements(input: {
  department: DepartmentName;
  experienceWeeks: number;
  priorDepartmentExperience: boolean;
  currentRank?: string;
}) {
  if (input.department === "DOT") return true;
  if (input.department === "K9" || input.department === "SWAT") {
    return input.currentRank === "Corporal" && input.experienceWeeks >= 3;
  }
  if (input.department === "Police" || input.department === "Fire" || input.department === "EMS") {
    return input.priorDepartmentExperience;
  }
  return input.experienceWeeks >= 3;
}

export function canPromote(input: { currentRank: string; department: DepartmentName; approvedActivitySeconds: number }) {
  const ladder = getRankLadder(input.department);
  const currentIndex = ladder.indexOf(input.currentRank);
  return currentIndex >= 0 && currentIndex < ladder.length - 1 && input.approvedActivitySeconds >= 2 * 60 * 60;
}

export function createBadgeNumber(existing: Iterable<string>, random = Math.random) {
  const used = new Set(existing);
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const candidate = String(Math.floor(100 + random() * 9900));
    if (!used.has(candidate)) return candidate;
  }
  throw new Error("Unable to allocate a unique badge number");
}

export function createCallsign(rank: string, displayName: string, department: DepartmentName, badgeNumber: string) {
  const name = displayName.trim().split(/\s+/).filter(Boolean);
  const abbreviated = name.length > 1 ? `${name[0][0]}.${name[name.length - 1]}` : name[0] ?? "Employee";
  const unit = department === "Admin / HR" ? "HR" : department;
  return `${rank} | ${abbreviated} ${unit} | ${badgeNumber}`;
}

export function normalizeSignature(signature: string) {
  return signature.trim().replace(/\s+/g, " ").slice(0, 100);
}

export function createClockRecord(signature: string, now = new Date()) {
  const normalized = normalizeSignature(signature);
  if (normalized.length < 2) throw new Error("A signature of at least two characters is required");
  return { signature: normalized, timestamp: now.toISOString() };
}