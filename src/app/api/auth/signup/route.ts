import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { AccountType, createSessionToken, hashPassword, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const signupSchema = z.object({
  username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(8).max(128),
  accountType: z.enum(["EMPLOYEE", "HR"]),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Use a 3-32 character username and a password of at least 8 characters." }, { status: 400 });
  }

  const username = parsed.data.username.toLowerCase();
  const accountType = parsed.data.accountType as AccountType;
  const accountStatus = accountType === "EMPLOYEE" ? "ACTIVE" : "PENDING_APPROVAL";

  try {
    const passwordHash = await hashPassword(parsed.data.password);
    const employee = await prisma.employee.create({
      data: { username, passwordHash, accountType, accountStatus },
      select: { id: true, username: true, accountType: true, accountStatus: true },
    });
    const token = createSessionToken({
      sub: employee.id,
      username: employee.username,
      accountType: employee.accountType,
      accountStatus: employee.accountStatus,
    });
    const response = NextResponse.json({ username: employee.username, accountType: employee.accountType, accountStatus: employee.accountStatus }, { status: 201 });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
    return response;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "That username is already registered." }, { status: 409 });
    }
    return NextResponse.json({ error: "Sign up is temporarily unavailable. Check the database setup and try again." }, { status: 503 });
  }
}