import { withVisibleTask } from "@/lib/mobileApi";
import { POST as addNote } from "@/app/api/tasks/[id]/notes/route";

type RouteContext = { params: Promise<{ id: string }> };

// ── POST /api/mobile/v1/tasks/:id/notes ── { text } ──────────────────────────
export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  return withVisibleTask(id, () => addNote(request, context));
}
