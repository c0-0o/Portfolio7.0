import { readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const APP_DIRECTORY = join(process.cwd(), "app");
const PAGE_FILE_NAMES = new Set(["page.tsx", "page.ts", "page.jsx", "page.js"]);

async function findPageRoutes(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedRoutes = await Promise.all(entries
    .filter((entry) =>
      entry.isDirectory() &&
      !entry.name.startsWith("_") &&
      !entry.name.startsWith("@") &&
      entry.name !== "api",
    )
    .map((entry) => findPageRoutes(join(directory, entry.name))));
  const hasPage = entries.some((entry) => entry.isFile() && PAGE_FILE_NAMES.has(entry.name));
  const directorySegments = relative(APP_DIRECTORY, directory)
    .split(sep)
    .filter((segment) => segment && !(segment.startsWith("(") && segment.endsWith(")")));
  const route = `/${directorySegments.join("/")}`.replace(/\/$/, "") || "/";
  const localRoutes = hasPage && route !== "/editor" && route !== "/editor-login" ? [route] : [];
  return [...localRoutes, ...nestedRoutes.flat()];
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const paths = Array.from(new Set(await findPageRoutes(APP_DIRECTORY)))
      .sort((left, right) => left === "/" ? -1 : right === "/" ? 1 : left.localeCompare(right));
    return Response.json({ paths }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not discover App Router pages for the magnetic editor.", error);
    return Response.json({ error: "Could not discover app pages." }, { status: 500 });
  }
}
