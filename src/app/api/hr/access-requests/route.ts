import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedEmployee } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const reviewer = await getAuthenticatedEmployee(request);
    if (!reviewer || reviewer.accountType !== "HR") {
      return NextResponse.json({ error: "HR authorization is required." }, { status: 403 });
    }

    const requests = await prisma.accessRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        requestType: true,
        requestNote: true,
        createdAt: true,
        employee: { select: { id: true, username: true, department: true, rank: true } },
      },
    });
    return NextResponse.json({ requests });
  } catch {
    return NextResponse.json({ error: "Could not load the HR review queue." }, { status: 503 });
  }
}