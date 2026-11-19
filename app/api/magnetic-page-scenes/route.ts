import { normalizeMagneticPagePath } from "@/lib/magnetic-lines/persistence";
import { hasValidEditorSession } from "@/lib/editorAuth";
import { importLegacyProjectPageScenes, readProjectPageScenes, removeProjectPageScene, saveProjectPageScene } from "@/lib/magnetic-lines/projectSceneStore";
import type { MagneticLinesSceneConfig } from "@/lib/magnetic-lines/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function canWrite(request: Request): boolean {
  if (process.env.NODE_ENV === "production" || !hasValidEditorSession(request)) return false;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function errorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  try {
    const { scenes, exists, needsLegacyImport } = await readProjectPageScenes();
    return Response.json({ scenes, exists, needsLegacyImport }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not read project magnetic-scene data.", error);
    return errorResponse("Could not read project magnetic-scene data.", 500);
  }
}

export async function POST(request: Request) {
  if (!canWrite(request)) return errorResponse("Project scene editing requires the authenticated same-origin development editor.", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("The legacy scene import request must contain valid JSON.", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body) || !("scenes" in body) ||
      !body.scenes || typeof body.scenes !== "object" || Array.isArray(body.scenes)) {
    return errorResponse("The legacy scene import request contains invalid scenes.", 400);
  }
  for (const [path, scene] of Object.entries(body.scenes)) {
    if (
      normalizeMagneticPagePath(path) !== path ||
      path === "/editor" ||
      !scene ||
      typeof scene !== "object" ||
      Array.isArray(scene) ||
      !("lines" in scene) ||
      !Array.isArray(scene.lines)
    ) {
      return errorResponse("The legacy scene import request contains invalid scenes.", 400);
    }
  }

  try {
    await importLegacyProjectPageScenes(body.scenes as Record<string, unknown>);
    return Response.json({ imported: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not import legacy browser magnetic-scene data into project files.", error);
    return errorResponse("Could not import legacy browser scene data.", 500);
  }
}

export async function PUT(request: Request) {
  if (!canWrite(request)) return errorResponse("Project scene editing requires the authenticated same-origin development editor.", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("The scene save request must contain valid JSON.", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return errorResponse("The scene save request must be an object.", 400);
  }

  const candidate = body as { path?: unknown; scene?: unknown };
  const path = typeof candidate.path === "string" ? normalizeMagneticPagePath(candidate.path) : null;
  if (!path || path === "/editor" || path !== candidate.path) {
    return errorResponse("The scene save request contains an invalid page path.", 400);
  }
  if (
    !candidate.scene ||
    typeof candidate.scene !== "object" ||
    Array.isArray(candidate.scene) ||
    !Array.isArray((candidate.scene as Partial<MagneticLinesSceneConfig>).lines)
  ) {
    return errorResponse("The scene save request contains an invalid scene.", 400);
  }

  try {
    await saveProjectPageScene(path, candidate.scene as MagneticLinesSceneConfig);
    return Response.json({ saved: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(`Could not save project magnetic-scene data for ${path}.`, error);
    return errorResponse("Could not save project magnetic-scene data.", 500);
  }
}

export async function DELETE(request: Request) {
  if (!canWrite(request)) return errorResponse("Project scene editing requires the authenticated same-origin development editor.", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("The scene delete request must contain valid JSON.", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body) || !("path" in body) || typeof body.path !== "string") {
    return errorResponse("The scene delete request contains an invalid page path.", 400);
  }
  const path = normalizeMagneticPagePath(body.path);
  if (!path || path === "/editor" || path !== body.path) {
    return errorResponse("The scene delete request contains an invalid page path.", 400);
  }

  try {
    await removeProjectPageScene(path);
    return Response.json({ removed: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(`Could not remove project magnetic-scene data for ${path}.`, error);
    return errorResponse("Could not remove project magnetic-scene data.", 500);
  }
}
