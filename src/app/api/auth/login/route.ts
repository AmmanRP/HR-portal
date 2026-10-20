import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const loginSchema = z.object({
  username: z.string().trim().min(1).max(32),
  password: z.string().min(1).max(128),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter your username and password." }, { status: 400 });

  try {
    const employee = await prisma.employee.findUnique({ where: { username: parsed.data.username.toLowerCase() } });
    if (!employee || !(await verifyPassword(parsed.data.password, employee.passwordHash))) {
      return NextResponse.json({ error: "Username or password is incorrect." }, { status: 401 });
    }
    if (employee.accountStatus === "SUSPENDED") {
      return NextResponse.json({ error: "This account is unavailable. Contact an administrator." }, { status: 403 });
    }

    const token = createSessionToken({
      sub: employee.id,
      username: employee.username,
      accountType: employee.accountType,
      accountStatus: employee.accountStatus,
    });
    const response = NextResponse.json({ username: employee.username, accountType: employee.accountType, accountStatus: employee.accountStatus });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
    return response;
  } catch {
    return NextResponse.json({ error: "Login is temporarily unavailable. Check the database setup and try again." }, { status: 503 });
  }
}