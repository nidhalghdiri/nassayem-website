"use server";

import prisma from "@/lib/prisma";
import { EquipmentStatus, EquipmentVisitStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function getEquipments() {
  return await prisma.equipment.findMany({
    include: {
      building: true,
      type: true,
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
      type: true,
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
      type: true,
    },
  });
}

export async function getEquipmentTypes() {
  return await prisma.equipmentType.findMany({
    orderBy: { nameAr: "asc" }
  });
}

export async function createEquipmentType(data: { nameAr: string; nameEn?: string }) {
  const t = await prisma.equipmentType.create({
    data: {
      nameAr: data.nameAr,
      nameEn: data.nameEn
    }
  });
  revalidatePath("/[locale]/admin/maintenance/equipment");
  return t;
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
  let newEqStatus: EquipmentStatus = "GOOD";
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
  typeId: string;
  brandModel: string;
}) {
  const equipment = await prisma.equipment.create({
    data: {
      qrCode: data.qrCode,
      buildingId: data.buildingId,
      unitNumber: data.unitNumber,
      typeId: data.typeId,
      brandModel: data.brandModel,
      status: "GOOD",
    },
  });

  revalidatePath("/[locale]/admin/maintenance/equipment");
  return equipment;
}

export async function updateEquipment(id: string, data: {
  qrCode?: string;
  buildingId?: string;
  unitNumber?: string | null;
  typeId?: string;
  brandModel?: string;
  status?: EquipmentStatus;
}) {
  const equipment = await prisma.equipment.update({
    where: { id },
    data,
  });

  revalidatePath("/[locale]/admin/maintenance/equipment");
  revalidatePath(`/[locale]/admin/maintenance/equipment/${id}`);
  return equipment;
}
