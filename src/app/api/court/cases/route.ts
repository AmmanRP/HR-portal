import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedEmployee } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";

const chargeSchema = z.object({
  defendantName: z.string().trim().min(2).max(60),
  stateCode: z.string().trim().min(2).max(24),
  charge: z.string().trim().min(2).max(80),
  classification: z.enum(["MISDEMEANOR", "FELONY", "INFRACTION"]),
  summary: z.string().trim().min(8).max(1200),
});

export async function POST(request: NextRequest) {
  const employee = await getAuthenticatedEmployee(request);
  if (!employee) return NextResponse.json({ error: "Sign in to file a charge." }, { status: 401 });
  const profile = await prisma.courtProfile.findUnique({ where: { employeeId: employee.id } });
  if (!profile || profile.role !== "OFFICER") return NextResponse.json({ error: "Only an officer character may file charges." }, { status: 403 });

  const parsed = chargeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the charge details." }, { status: 400 });

  const defendant = await prisma.courtProfile.findFirst({
    where: { characterName: { equals: parsed.data.defendantName }, role: "SUSPECT" },
    select: { id: true },
  });
  const caseNumber = `WB-${new Date().getFullYear()}-${randomUUID().slice(0, 6).toUpperCase()}`;
  const courtCase = await prisma.courtCase.create({
    data: {
      ...parsed.data,
      caseNumber,
      filedById: profile.id,
      ...(defendant ? { defendantId: defendant.id } : {}),
      events: { create: { actorId: profile.id, action: "CHARGE_FILED", details: `${parsed.data.charge} filed under ${parsed.data.stateCode}.` } },
    },
  });
  return NextResponse.json({ case: courtCase }, { status: 201 });
}
