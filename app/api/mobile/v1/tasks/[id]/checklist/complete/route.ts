import { withVisibleTask } from "@/lib/mobileApi";
import { POST as completeInspection } from "@/app/api/tasks/[id]/checklist/complete/route";

type RouteContext = { params: Promise<{ id: string }> };

// ── POST /api/mobile/v1/tasks/:id/checklist/complete ── { inspectorNotes? } ──
// Finishes the inspection: ISSUES_FOUND when any item failed, else NO_ISSUES.
export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  return withVisibleTask(id, () => completeInspection(request, context));
}
