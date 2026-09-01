"use server";

import prisma from "@/lib/prisma";
import { EquipmentStatus, EquipmentVisitStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function getEquipments() {
  return await prisma.equipment.findMany({
    include: {
      building: true,
      visits: {
        orderBy: { visitDate: "desc" },
        take: 1,
      },
      _count: {
        select: { visits: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getEquipmentById(id: string) {
  return await prisma.equipment.findUnique({
    where: { id },
    include: {
      building: true,
      visits: {
        include: { technician: true },
        orderBy: { visitDate: "desc" },
      },
    },
  });
}

export async function getEquipmentByQrCode(qrCode: string) {
  return await prisma.equipment.findUnique({
    where: { qrCode },
    include: {
      building: true,
    },
  });
}

export async function logMaintenanceVisit(data: {
  equipmentId: string;
  technicianId: string;
  issueDescription: string;
  actionTaken: string;
  status: EquipmentVisitStatus;
}) {
  const visit = await prisma.equipmentVisit.create({
    data: {
      equipmentId: data.equipmentId,
      technicianId: data.technicianId,
      issueDescription: data.issueDescription,
      actionTaken: data.actionTaken,
      status: data.status,
      visitDate: new Date(),
    },
  });

  // Update equipment status based on visit status
  let newEqStatus: EquipmentStatus = "WORKING";
  if (data.status === "NEEDS_PARTS" || data.status === "UNRESOLVED") {
    newEqStatus = "NEEDS_REPAIR";
  }

  await prisma.equipment.update({
    where: { id: data.equipmentId },
    data: { status: newEqStatus },
  });

  revalidatePath("/[locale]/admin/maintenance/equipment");
  revalidatePath(`/[locale]/admin/maintenance/equipment/${data.equipmentId}`);

  return visit;
}

export async function createEquipment(data: {
  qrCode: string;
  buildingId: string;
  unitNumber?: string;
  type: string;
  brandModel: string;
}) {
  const equipment = await prisma.equipment.create({
    data: {
      qrCode: data.qrCode,
      buildingId: data.buildingId,
      unitNumber: data.unitNumber,
      type: data.type,
      brandModel: data.brandModel,
      status: "WORKING",
    },
  });

  revalidatePath("/[locale]/admin/maintenance/equipment");
  return equipment;
}
