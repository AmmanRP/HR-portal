import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyPassword, createSessionToken, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const loginSchema = z.object({
  username: z.string().trim().min(1).max(32),
  password: z.string().min(1).max(128),
});

export async function POST(request: NextRequest) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter your username and password." }, { status: 400 });

  const employee = await prisma.employee.findUnique({ where: { username: parsed.data.username.toLowerCase() } });
  if (!employee || employee.accountStatus === "SUSPENDED" || !(await verifyPassword(parsed.data.password, employee.passwordHash))) {
    return NextResponse.json({ error: "The username or password is incorrect." }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, createSessionToken({
    sub: employee.id,
    username: employee.username,
    accountType: employee.accountType,
    accountStatus: employee.accountStatus,
  }), sessionCookieOptions);
  return response;
}
