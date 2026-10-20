import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedEmployee } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const reviewSchema = z.object({
  decision: z.enum(["APPROVE", "DENY"]),
  reviewNote: z.string().trim().max(500).optional(),
}).refine((value) => value.decision !== "DENY" || Boolean(value.reviewNote), {
  message: "Add a note when denying a request.",
});

export async function POST(request: NextRequest, context: { params: Promise<{ requestId: string }> }) {
  try {
    const reviewer = await getAuthenticatedEmployee(request);
    if (!reviewer || reviewer.accountType !== "HR") {
      return NextResponse.json({ error: "HR authorization is required." }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid review decision." }, { status: 400 });

    const { requestId } = await context.params;
    const accessRequest = await prisma.accessRequest.findUnique({ where: { id: requestId } });
    if (!accessRequest) return NextResponse.json({ error: "Access request not found." }, { status: 404 });
    if (accessRequest.status !== "PENDING") return NextResponse.json({ error: "This request has already been reviewed." }, { status: 409 });
    if (accessRequest.employeeId === reviewer.id) return NextResponse.json({ error: "You cannot review your own access request." }, { status: 403 });

    const approved = parsed.data.decision === "APPROVE";
    const nextStatus = approved ? "APPROVED" : "DENIED";
    const reviewResult = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.accessRequest.updateMany({
        where: { id: requestId, status: "PENDING" },
        data: {
          status: nextStatus,
          reviewNote: parsed.data.reviewNote || null,
          reviewedById: reviewer.id,
          reviewedAt: new Date(),
        },
      });
      if (updated.count === 0) return false;

      if (approved) {
        await transaction.employee.update({
          where: { id: accessRequest.employeeId },
          data: accessRequest.requestType === "FTO" ? { ftoApproved: true } : { supervisorApproved: true },
        });
      }
      return true;
    });

    if (!reviewResult) return NextResponse.json({ error: "This request has already been reviewed." }, { status: 409 });
    return NextResponse.json({ requestId, status: nextStatus });
  } catch {
    return NextResponse.json({ error: "Could not save the review decision." }, { status: 503 });
  }
}