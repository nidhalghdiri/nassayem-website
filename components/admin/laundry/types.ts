// Shared serialized types for the Laundry admin UI (Date → ISO string).

export type Building = { id: string; nameEn: string; nameAr: string };

export type Person = {
  id: string;
  name: string | null;
  email: string;
  role?: string;
};

export type LaundryItemLine = {
  id: string;
  itemTypeId: string;
  nameEn: string;
  nameAr: string;
  requestedQty: number;
  pickedUpQty: number | null;
  atLaundryQty: number | null;
  returnedQty: number | null;
  deliveredQty: number | null;
};

export type SerializedLaundryOrder = {
  id: string;
  orderCode: string;
  status: string;
  priority: string;
  neededDate: string;
  notes: string | null;
  createdAt: string;
  pickedUpAt: string | null;
  atLaundryAt: string | null;
  processingAt: string | null;
  readyAt: string | null;
  outForDeliveryAt: string | null;
  deliveredAt: string | null;
  building: Building | null;
  requestedBy: Person | null;
  supervisor: Person | null;
  laundryUser: Person | null;
  items: LaundryItemLine[];
  totalRequested: number;
  totalMissing: number;
  hasDiscrepancy: boolean;
};

export type LaundryEventItem = {
  id: string;
  action: string;
  details: string;
  createdAt: string;
  user: Person;
};

export type LaundryItemTypeOption = {
  id: string;
  nameEn: string;
  nameAr: string;
};
