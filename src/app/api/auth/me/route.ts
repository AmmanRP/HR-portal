import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? verifySessionToken(token) : null;
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const employee = await prisma.employee.findUnique({
      where: { id: session.sub },
      select: { username: true, accountType: true, accountStatus: true, ftoApproved: true, supervisorApproved: true },
    });
    if (!employee || employee.accountStatus === "SUSPENDED") {
      const response = NextResponse.json({ error: "Not signed in." }, { status: 401 });
      response.cookies.delete(SESSION_COOKIE);
      return response;
    }
    return NextResponse.json(employee);
  } catch {
    return NextResponse.json({ error: "Account lookup is temporarily unavailable." }, { status: 503 });
  }
}