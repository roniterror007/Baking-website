import { ApiError, bucket, database, identity, isOwner, route } from "@/lib/server-store";

export async function GET(_request: Request, context: { params: Promise<{ key: string }> }) {
  return route(async () => {
    const user = await identity(); const { key } = await context.params;
    if (!/^references\/[a-f0-9-]+\.(jpg|png|webp)$/.test(key)) throw new ApiError(404,"image_not_found","Reference image not found.");
    const row = await database().prepare("SELECT user_id,content_type FROM uploads WHERE key=?").bind(key).first<{ user_id:string; content_type:string }>();
    if (!row || (row.user_id !== user.userId && !isOwner(user))) throw new ApiError(404,"image_not_found","Reference image not found.");
    const object = await bucket().get(key); if (!object) throw new ApiError(404,"image_not_found","Reference image not found.");
    return new Response(object.body,{ headers:{ "Content-Type":row.content_type,"Content-Disposition":"inline",
      "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; sandbox" } });
  });
}
