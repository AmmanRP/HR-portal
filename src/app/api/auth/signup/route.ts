import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, createSessionToken, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const signupSchema = z.object({
  username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(8).max(128),
  accountType: z.enum(["EMPLOYEE", "HR"]).default("EMPLOYEE"),
});

export async function POST(request: NextRequest) {
  const parsed = signupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid username and a password of at least 8 characters." }, { status: 400 });
  }

  const username = parsed.data.username.toLowerCase();
  if (await prisma.employee.findUnique({ where: { username }, select: { id: true } })) {
    return NextResponse.json({ error: "That username is already in use." }, { status: 409 });
  }

  try {
    const employee = await prisma.employee.create({
      data: {
        username,
        passwordHash: await hashPassword(parsed.data.password),
        accountType: parsed.data.accountType,
        accountStatus: parsed.data.accountType === "HR" ? "PENDING_APPROVAL" : "ACTIVE",
      },
      select: { id: true, username: true, accountType: true, accountStatus: true },
    });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, createSessionToken({
      sub: employee.id,
      username: employee.username,
      accountType: employee.accountType,
      accountStatus: employee.accountStatus,
    }), sessionCookieOptions);
    return response;
  } catch (error) {
    console.error("Could not create PatrolDesk account", error);
    return NextResponse.json({ error: "Could not create your account. Please try again." }, { status: 500 });
  }
}
