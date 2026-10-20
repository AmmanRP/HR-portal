import { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getAuthenticatedEmployee(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? verifySessionToken(token) : null;
  if (!session) return null;

  const employee = await prisma.employee.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      username: true,
      accountType: true,
      accountStatus: true,
      ftoApproved: true,
      supervisorApproved: true,
    },
  });
  if (!employee || employee.accountStatus !== "ACTIVE") return null;
  return employee;
}