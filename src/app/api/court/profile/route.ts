import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedEmployee } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";

const profileSchema = z.object({
  role: z.enum(["OFFICER", "SUSPECT", "ATTORNEY", "WITNESS", "JUDGE"]),
  characterName: z.string().trim().min(2).max(60),
  fictionalSsn: z.string().regex(/^\d{9}$/, "Use a 9-digit fictional in-game number."),
  birthDate: z.string().date(),
  address: z.string().trim().min(3).max(120),
  height: z.string().trim().min(2).max(20),
});

export async function POST(request: NextRequest) {
  const employee = await getAuthenticatedEmployee(request);
  if (!employee) return NextResponse.json({ error: "Sign in to create a court profile." }, { status: 401 });
  if (await prisma.courtProfile.findUnique({ where: { employeeId: employee.id }, select: { id: true } })) {
    return NextResponse.json({ error: "A court character profile already exists for this account." }, { status: 409 });
  }

  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check your profile details." }, { status: 400 });

  if (parsed.data.role === "OFFICER" && !["POLICE", "DETECTIVE", "SWAT", "K9"].includes(employee.department ?? "")) {
    return NextResponse.json({ error: "Officer profiles require an assigned law-enforcement department." }, { status: 403 });
  }
  if (parsed.data.role === "JUDGE" && employee.department !== "JUDGE") {
    return NextResponse.json({ error: "Judge profiles require an assigned Judge department." }, { status: 403 });
  }
  const birthDate = new Date(`${parsed.data.birthDate}T12:00:00.000Z`);
  if (birthDate >= new Date()) return NextResponse.json({ error: "The in-game birth date must be in the past." }, { status: 400 });

  try {
    const profile = await prisma.courtProfile.create({
      data: { ...parsed.data, birthDate, employeeId: employee.id },
    });
    return NextResponse.json({ profile }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "That fictional in-game number is already in use." }, { status: 409 });
    }
    console.error("Could not create court character profile", error);
    return NextResponse.json({ error: "Could not save your profile. Please try again." }, { status: 500 });
  }
}
