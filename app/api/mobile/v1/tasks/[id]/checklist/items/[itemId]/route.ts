import { withVisibleTask } from "@/lib/mobileApi";
import { PATCH as updateItem } from "@/app/api/tasks/[id]/checklist/items/[itemId]/route";

type RouteContext = { params: Promise<{ id: string; itemId: string }> };

// ── PATCH /api/mobile/v1/tasks/:id/checklist/items/:itemId ───────────────────
// { status: "pending" | "pass" | "fail" | "na", notes? }
export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  return withVisibleTask(id, () => updateItem(request, context));
}
