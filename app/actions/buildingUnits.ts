"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import type { UnitType } from "@prisma/client";

export async function createBuildingUnit(buildingId: string, data: { name: string; netsuiteId?: string; type?: UnitType | null }) {
  const admin = await getCurrentAdminUser();
  if (!admin) return { error: "Unauthorized" };

  try {
    const unit = await prisma.buildingUnit.create({
      data: {
        buildingId,
        name: data.name,
        netsuiteId: data.netsuiteId || null,
        type: data.type || null,
      },
    });
    
    revalidatePath(`/[locale]/admin/buildings/${buildingId}/units`, "page");
    return { success: true, unit };
  } catch (error: any) {
    console.error("Failed to create building unit:", error);
    if (error.code === 'P2002') {
      return { error: "A unit with this name or Netsuite ID already exists." };
    }
    return { error: "Failed to create unit." };
  }
}

export async function updateBuildingUnit(id: string, buildingId: string, data: { name: string; netsuiteId?: string; type?: UnitType | null }) {
  const admin = await getCurrentAdminUser();
  if (!admin) return { error: "Unauthorized" };

  try {
    const unit = await prisma.buildingUnit.update({
      where: { id },
      data: {
        name: data.name,
        netsuiteId: data.netsuiteId || null,
        type: data.type || null,
      },
    });
    
    revalidatePath(`/[locale]/admin/buildings/${buildingId}/units`, "page");
    return { success: true, unit };
  } catch (error: any) {
    console.error("Failed to update building unit:", error);
    if (error.code === 'P2002') {
      return { error: "A unit with this name or Netsuite ID already exists." };
    }
    return { error: "Failed to update unit." };
  }
}

export async function deleteBuildingUnit(id: string, buildingId: string) {
  const admin = await getCurrentAdminUser();
  if (!admin) return { error: "Unauthorized" };

  try {
    // Check if tasks are connected
    const taskCount = await prisma.task.count({ where: { unitId: id } });
    if (taskCount > 0) {
      return { error: `Cannot delete unit because it is linked to ${taskCount} tasks.` };
    }

    await prisma.buildingUnit.delete({
      where: { id },
    });
    
    revalidatePath(`/[locale]/admin/buildings/${buildingId}/units`, "page");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete building unit:", error);
    return { error: "Failed to delete unit." };
  }
}
