import { catalog, route, json } from "@/lib/server-store";
export async function GET() { return route(async () => json(await catalog())); }
