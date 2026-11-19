import { NextResponse, type NextRequest } from "next/server";
import { hasValidEditorSession } from "@/lib/editorAuth";

function requiresEditorSession(request: NextRequest): boolean {
  const { pathname } = request.nextUrl;
  if (pathname === "/editor" || pathname.startsWith("/editor/")) return true;
  if (pathname === "/api/magnetic-pages") return true;
  return pathname === "/api/magnetic-page-scenes" &&
    request.method !== "GET" &&
    request.method !== "HEAD";
}

export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV === "production" || !requiresEditorSession(request)) {
    return NextResponse.next();
  }

  if (!process.env.EDITOR_PASSWORD) {
    return request.nextUrl.pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Editor access is not configured." }, { status: 503 })
      : NextResponse.redirect(new URL("/editor-login", request.url));
  }

  if (hasValidEditorSession(request)) return NextResponse.next();

  if (request.nextUrl.pathname === "/editor" || request.nextUrl.pathname.startsWith("/editor/")) {
    return NextResponse.redirect(new URL("/editor-login", request.url));
  }

  return NextResponse.json(
    { error: "Editor authentication is required." },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}

export const config = {
  matcher: ["/editor/:path*", "/api/magnetic-pages", "/api/magnetic-page-scenes"],
};
