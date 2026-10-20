import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? verifySessionToken(token) : null;
  if (!session) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const employee = await prisma.employee.findUnique({
    where: { id: session.sub },
    select: { id: true, username: true, accountType: true, accountStatus: true, ftoApproved: true, supervisorApproved: true },
  });
  if (!employee || employee.accountStatus === "SUSPENDED") return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  return NextResponse.json(employee);
}
