import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedEmployee } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const employee = await getAuthenticatedEmployee(request);
  if (!employee) return NextResponse.json({ error: "Sign in to access the court portal." }, { status: 401 });

  const profile = await prisma.courtProfile.findUnique({ where: { employeeId: employee.id } });
  if (!profile) return NextResponse.json({ profile: null, cases: [] });

  const cases = await prisma.courtCase.findMany({
    where: profile.role === "JUDGE" || profile.role === "ATTORNEY" || profile.role === "WITNESS" ? {} : {
      OR: [
        { filedById: profile.id },
        { defendantId: profile.id },
        { defendantName: profile.characterName },
        { participants: { some: { profileId: profile.id } } },
      ],
    },
    include: {
      filedBy: { select: { characterName: true, employee: { select: { username: true, badgeNumber: true } } } },
      defendant: { select: { characterName: true } },
      evidence: { orderBy: { createdAt: "asc" }, include: { submittedBy: { select: { characterName: true } } } },
      participants: { include: { profile: { select: { characterName: true } } } },
      events: { orderBy: { createdAt: "desc" }, take: 30, include: { actor: { select: { characterName: true } } } },
    },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ profile, cases });
}
