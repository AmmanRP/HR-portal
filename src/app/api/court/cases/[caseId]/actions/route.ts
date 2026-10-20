import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedEmployee } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("SCHEDULE"), scheduledAt: z.string().datetime() }),
  z.object({ action: z.literal("JOIN"), targetName: z.string().trim().min(2).max(60).optional() }),
  z.object({ action: z.literal("PLEA"), plea: z.enum(["GUILTY", "NOT_GUILTY"]) }),
  z.object({ action: z.literal("EVIDENCE"), label: z.string().trim().min(2).max(80), description: z.string().trim().min(5).max(1200) }),
  z.object({ action: z.literal("VERDICT"), outcome: z.enum(["GUILTY", "NOT_GUILTY", "DISMISSED"]) }),
]);

const participantRoleSchema = z.enum(["OFFICER", "SUSPECT", "ATTORNEY", "WITNESS", "JUDGE"]);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ caseId: string }> },
) {
  const employee = await getAuthenticatedEmployee(request);
  if (!employee) return NextResponse.json({ error: "Sign in to access this case." }, { status: 401 });
  const profile = await prisma.courtProfile.findUnique({ where: { employeeId: employee.id } });
  if (!profile) return NextResponse.json({ error: "Create a court character profile first." }, { status: 403 });
  const { caseId } = await context.params;
  const courtCase = await prisma.courtCase.findUnique({ where: { id: caseId } });
  if (!courtCase) return NextResponse.json({ error: "Case not found." }, { status: 404 });

  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid case action." }, { status: 400 });
  const action = parsed.data;

  if (action.action === "JOIN") {
    if (["RESOLVED", "DISMISSED"].includes(courtCase.status)) return NextResponse.json({ error: "This case is closed." }, { status: 409 });
    if (profile.role === "OFFICER" && courtCase.filedById !== profile.id) return NextResponse.json({ error: "Only the arresting officer may join as officer." }, { status: 403 });
    if (profile.role === "SUSPECT" && courtCase.defendantId !== profile.id && courtCase.defendantName.toLowerCase() !== profile.characterName.toLowerCase()) {
      return NextResponse.json({ error: "This case is not assigned to your character." }, { status: 403 });
    }
    if (profile.role === "ATTORNEY" && action.targetName?.toLowerCase() !== courtCase.defendantName.toLowerCase()) {
      return NextResponse.json({ error: "Select the defendant character you represent before joining." }, { status: 400 });
    }
    if (profile.role === "WITNESS") {
      if (!action.targetName) return NextResponse.json({ error: "Select the arresting officer by character name, account, or badge." }, { status: 400 });
      const officer = await prisma.courtProfile.findUnique({
        where: { id: courtCase.filedById },
        select: { characterName: true, employee: { select: { username: true, badgeNumber: true } } },
      });
      const target = action.targetName.toLowerCase();
      const officerIdentifiers = [officer?.characterName, officer?.employee.username, officer?.employee.badgeNumber]
        .filter((identifier): identifier is string => Boolean(identifier))
        .map((identifier) => identifier.toLowerCase());
      if (!officerIdentifiers.includes(target)) return NextResponse.json({ error: "The selected name or badge does not match this case's arresting officer." }, { status: 403 });
    }
    const participantRole = participantRoleSchema.safeParse(profile.role);
    if (!participantRole.success) return NextResponse.json({ error: "This character has an invalid court role." }, { status: 500 });
    await prisma.$transaction(async (transaction) => {
      await transaction.courtParticipant.upsert({
        where: { caseId_profileId: { caseId, profileId: profile.id } },
        create: { caseId, profileId: profile.id, role: participantRole.data },
        update: {},
      });
      if (courtCase.status === "SCHEDULED" && courtCase.scheduledAt && courtCase.scheduledAt <= new Date()) {
        await transaction.courtCase.update({ where: { id: caseId }, data: { status: "IN_TRIAL" } });
      }
      await transaction.courtEvent.create({ data: { caseId, actorId: profile.id, action: "PARTICIPANT_JOINED", details: `${profile.characterName} joined as ${profile.role.toLowerCase()}.` } });
    });
    return NextResponse.json({ ok: true });
  }

  if (action.action === "SCHEDULE") {
    if (profile.role !== "JUDGE") return NextResponse.json({ error: "Only a judge may schedule court." }, { status: 403 });
    const scheduledAt = new Date(action.scheduledAt);
    if (scheduledAt <= new Date()) return NextResponse.json({ error: "Choose a future court date and time." }, { status: 400 });
    if (["RESOLVED", "DISMISSED"].includes(courtCase.status)) return NextResponse.json({ error: "This case is closed." }, { status: 409 });
    await prisma.$transaction(async (transaction) => {
      await transaction.courtCase.update({ where: { id: caseId }, data: { scheduledAt, status: "SCHEDULED" } });
      await transaction.courtEvent.create({ data: { caseId, actorId: profile.id, action: "COURT_SCHEDULED", details: `Court scheduled for ${scheduledAt.toISOString()}.` } });
    });
    return NextResponse.json({ ok: true });
  }

  if (action.action === "PLEA") {
    if (profile.role !== "SUSPECT" || (courtCase.defendantId !== profile.id && courtCase.defendantName.toLowerCase() !== profile.characterName.toLowerCase())) {
      return NextResponse.json({ error: "Only the defendant may enter a plea." }, { status: 403 });
    }
    if (["RESOLVED", "DISMISSED"].includes(courtCase.status)) return NextResponse.json({ error: "This case is closed." }, { status: 409 });
    await prisma.$transaction(async (transaction) => {
      await transaction.courtCase.update({ where: { id: caseId }, data: { plea: action.plea } });
      await transaction.courtEvent.create({ data: { caseId, actorId: profile.id, action: "PLEA_ENTERED", details: `Defendant entered a ${action.plea.toLowerCase()} plea.` } });
    });
    return NextResponse.json({ ok: true });
  }

  if (action.action === "EVIDENCE") {
    if (profile.role !== "OFFICER" || courtCase.filedById !== profile.id) return NextResponse.json({ error: "Only the arresting officer may submit case evidence." }, { status: 403 });
    if (["RESOLVED", "DISMISSED"].includes(courtCase.status)) return NextResponse.json({ error: "This case is closed." }, { status: 409 });
    await prisma.$transaction(async (transaction) => {
      await transaction.courtEvidence.create({ data: { caseId, submittedById: profile.id, label: action.label, description: action.description } });
      await transaction.courtEvent.create({ data: { caseId, actorId: profile.id, action: "EVIDENCE_ADDED", details: `Evidence added: ${action.label}.` } });
    });
    return NextResponse.json({ ok: true });
  }

  if (profile.role !== "JUDGE") return NextResponse.json({ error: "Only a judge may enter a case outcome." }, { status: 403 });
  if (["RESOLVED", "DISMISSED"].includes(courtCase.status)) return NextResponse.json({ error: "This case already has a final outcome." }, { status: 409 });
  if (courtCase.status !== "IN_TRIAL") return NextResponse.json({ error: "The scheduled hearing must be live before the judge records an outcome." }, { status: 409 });
  if (!courtCase.plea) return NextResponse.json({ error: "The defendant must enter a plea before the judge records an outcome." }, { status: 409 });
  const [officerJoined, suspectJoined, witnessJoined, evidenceCount] = await Promise.all([
    prisma.courtParticipant.findFirst({ where: { caseId, role: "OFFICER" }, select: { id: true } }),
    prisma.courtParticipant.findFirst({ where: { caseId, role: "SUSPECT" }, select: { id: true } }),
    prisma.courtParticipant.findFirst({ where: { caseId, role: "WITNESS" }, select: { id: true } }),
    prisma.courtEvidence.count({ where: { caseId } }),
  ]);
  if (!officerJoined || !suspectJoined) return NextResponse.json({ error: "The defendant and arresting officer must join the hearing first." }, { status: 409 });
  if (evidenceCount === 0 && !witnessJoined) return NextResponse.json({ error: "Add roleplay evidence or have a witness join before entering an outcome." }, { status: 409 });
  const status = action.outcome === "DISMISSED" ? "DISMISSED" : "RESOLVED";
  await prisma.$transaction(async (transaction) => {
    await transaction.courtCase.update({ where: { id: caseId }, data: { outcome: action.outcome, status } });
    await transaction.courtEvent.create({ data: { caseId, actorId: profile.id, action: "OUTCOME_RECORDED", details: `Judge recorded ${action.outcome.toLowerCase().replace("_", " ")}.` } });
  });
  return NextResponse.json({ ok: true });
}
