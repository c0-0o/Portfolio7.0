import {
  createEditorSessionToken,
  EDITOR_SESSION_COOKIE,
  EDITOR_SESSION_MAX_AGE_SECONDS,
  verifyEditorPassword,
} from "@/lib/editorAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isSameOrigin(request: Request): boolean {
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

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") return errorResponse("The editor is available only in development.", 404);
  if (!isSameOrigin(request)) return errorResponse("Login requests must come from this site.", 403);
  if (!process.env.EDITOR_PASSWORD) return errorResponse("Editor access is not configured.", 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("The login request must contain valid JSON.", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body) || !("password" in body)) {
    return errorResponse("The login request is invalid.", 400);
  }
  if (!verifyEditorPassword(body.password)) return errorResponse("The password is incorrect.", 401);

  const token = createEditorSessionToken();
  if (!token) return errorResponse("Editor access is not configured.", 503);

  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return Response.json(
    { authenticated: true, redirectTo: "/editor" },
    {
      headers: {
        "Cache-Control": "no-store",
        "Set-Cookie": `${EDITOR_SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${EDITOR_SESSION_MAX_AGE_SECONDS}${secure}`,
      },
    },
  );
}

export async function DELETE(request: Request) {
  if (process.env.NODE_ENV === "production") return errorResponse("The editor is available only in development.", 404);
  if (!isSameOrigin(request)) return errorResponse("Logout requests must come from this site.", 403);
  return new Response(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store",
      "Set-Cookie": `${EDITOR_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`,
    },
  });
}
