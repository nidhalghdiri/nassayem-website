"use server";

import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { revalidatePath } from "next/cache";

export async function createEmployeeNote(formData: FormData) {
  const adminUser = await getCurrentAdminUser();
  if (!adminUser || !["MANAGER", "SUPERVISOR"].includes(adminUser.role)) {
    return { error: "Unauthorized" };
  }

  const employeeId = formData.get("employeeId") as string;
  const criteria = formData.get("criteria") as string;
  const noteType = formData.get("noteType") as string;
  const text = formData.get("text") as string;

  if (!employeeId || !criteria || !noteType || !text) {
    return { error: "Missing required fields" };
  }

  const isPositive = noteType === "positive";

  await prisma.employeeNote.create({
    data: {
      employeeId,
      authorId: adminUser.id,
      criteria,
      isPositive,
      text,
    },
  });

  revalidatePath("/[locale]/admin/tasks", "layout");
  return { success: true };
}
