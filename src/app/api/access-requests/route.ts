import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedEmployee } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const requestSchema = z.object({
  requestType: z.enum(["FTO", "SUPERVISOR"]),
  requestNote: z.string().trim().max(500).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const employee = await getAuthenticatedEmployee(request);
    if (!employee) return NextResponse.json({ error: "Sign in to view access requests." }, { status: 401 });

    const requests = await prisma.accessRequest.findMany({
      where: { employeeId: employee.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, requestType: true, status: true, requestNote: true, reviewNote: true, createdAt: true, reviewedAt: true },
    });
    return NextResponse.json({ requests, ftoApproved: employee.ftoApproved, supervisorApproved: employee.supervisorApproved });
  } catch {
    return NextResponse.json({ error: "Could not load access requests." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid access request." }, { status: 400 });

  try {
    const employee = await getAuthenticatedEmployee(request);
    if (!employee) return NextResponse.json({ error: "Sign in to request portal access." }, { status: 401 });

    const alreadyApproved = parsed.data.requestType === "FTO" ? employee.ftoApproved : employee.supervisorApproved;
    if (alreadyApproved) return NextResponse.json({ error: "You already have this portal access." }, { status: 409 });

    const pendingRequest = await prisma.accessRequest.findFirst({
      where: { employeeId: employee.id, requestType: parsed.data.requestType, status: "PENDING" },
      select: { id: true },
    });
    if (pendingRequest) return NextResponse.json({ error: "Your request is already waiting for HR review." }, { status: 409 });

    const accessRequest = await prisma.accessRequest.create({
      data: {
        employeeId: employee.id,
        requestType: parsed.data.requestType,
        requestNote: parsed.data.requestNote || null,
      },
      select: { id: true, requestType: true, status: true, createdAt: true },
    });
    return NextResponse.json({ request: accessRequest }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not submit your request." }, { status: 503 });
  }
}