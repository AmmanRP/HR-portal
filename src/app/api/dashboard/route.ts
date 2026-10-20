import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedEmployee } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const departmentLabels: Record<string, string> = {
  POLICE: "Police",
  FIRE: "Fire",
  EMS: "EMS",
  DOT: "DOT",
  SWAT: "SWAT",
  K9: "K9",
  JUDGE: "Judge",
  CSI: "CSI",
  DETECTIVE: "Detective",
  CORONER: "Coroner",
  ADMIN: "Admin / HR",
};

export async function GET(request: NextRequest) {
  try {
    const viewer = await getAuthenticatedEmployee(request);
    if (!viewer) return NextResponse.json({ error: "Sign in to view personnel data." }, { status: 401 });

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setUTCHours(0, 0, 0, 0);
    weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));

    const employees = await prisma.employee.findMany({
      where: { accountStatus: "ACTIVE", accountType: { in: ["EMPLOYEE", "FTO"] } },
      orderBy: [{ department: "asc" }, { username: "asc" }],
      select: {
        id: true,
        username: true,
        displayName: true,
        department: true,
        rank: true,
        badgeNumber: true,
        callsign: true,
        isActive: true,
        shifts: { orderBy: { clockInAt: "desc" }, take: 1, select: { clockInAt: true, clockOutAt: true } },
      },
    });
    const employeeIds = employees.map((employee) => employee.id);

    const [openShifts, weekShifts, pendingApplications, shiftsToReview, pendingAccessRequests, recentShifts] = await Promise.all([
      prisma.dutyShift.findMany({ where: { employeeId: { in: employeeIds }, clockOutAt: null }, select: { employeeId: true } }),
      prisma.dutyShift.findMany({ where: { employeeId: { in: employeeIds }, clockInAt: { gte: weekStart } }, select: { clockInAt: true, clockOutAt: true } }),
      prisma.application.count({ where: { status: { in: ["DRAFT", "INTERVIEW", "HUMAN_REVIEW"] } } }),
      prisma.dutyShift.count({ where: { clockOutAt: { not: null }, approvedAt: null } }),
      viewer.accountType === "HR" ? prisma.accessRequest.count({ where: { status: "PENDING" } }) : Promise.resolve(0),
      prisma.dutyShift.findMany({
        where: { employeeId: { in: employeeIds } },
        orderBy: { clockInAt: "desc" },
        take: 5,
        select: {
          id: true,
          clockInAt: true,
          clockOutAt: true,
          employee: { select: { username: true, displayName: true, department: true, rank: true } },
        },
      }),
    ]);

    const openEmployeeIds = new Set(openShifts.map((shift) => shift.employeeId));
    const departmentCounts = employees.reduce<Record<string, number>>((counts, employee) => {
      if (employee.department) counts[employee.department] = (counts[employee.department] ?? 0) + 1;
      return counts;
    }, {});
    const weekHours = weekShifts.reduce((total, shift) => {
      const end = shift.clockOutAt ?? now;
      return total + Math.max(0, end.getTime() - Math.max(shift.clockInAt.getTime(), weekStart.getTime()));
    }, 0) / 3_600_000;

    return NextResponse.json({
      asOf: now.toISOString(),
      employees: employees.map((employee) => ({
        id: employee.id,
        name: employee.displayName || employee.username,
        username: employee.username,
        department: employee.department ? departmentLabels[employee.department] : null,
        rank: employee.rank,
        badgeNumber: employee.badgeNumber,
        callsign: employee.callsign,
        isActive: employee.isActive,
        onDuty: openEmployeeIds.has(employee.id),
        lastClockInAt: employee.shifts[0]?.clockInAt.toISOString() ?? null,
      })),
      summary: {
        employeeCount: employees.length,
        onDutyCount: new Set(openShifts.map((shift) => shift.employeeId)).size,
        viewerOnDuty: openShifts.some((shift) => shift.employeeId === viewer.id),
        applicationCount: pendingApplications,
        weekHours: Math.round(weekHours * 10) / 10,
        shiftsToReview,
        pendingAccessRequests,
      },
      departmentCounts: Object.entries(departmentCounts).map(([key, count]) => ({ name: departmentLabels[key], count })),
      recentShifts: recentShifts.map((shift) => ({
        id: shift.id,
        name: shift.employee.displayName || shift.employee.username,
        department: shift.employee.department ? departmentLabels[shift.employee.department] : null,
        rank: shift.employee.rank,
        clockInAt: shift.clockInAt.toISOString(),
        clockOutAt: shift.clockOutAt?.toISOString() ?? null,
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Dashboard data is unavailable. Check the database connection." }, { status: 503 });
  }
}