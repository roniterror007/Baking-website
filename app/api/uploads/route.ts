import { ApiError, boundedBytes, bucket, database, identity, json, mutation, rateLimit, route } from "@/lib/server-store";
import { imageType } from "@/lib/server-validation";

export async function POST(request: Request) {
  return route(async () => {
    mutation(request); const user = await identity(); await rateLimit(user.userId,"uploads",10,3600);
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.startsWith("multipart/form-data;")) throw new ApiError(415,"invalid_upload","Upload a JPEG, PNG, or WebP image.");
    const bytes = await boundedBytes(request,4*1024*1024+16384);
    let form: FormData;
    try { form = await new Request(request.url,{ method:"POST",headers:{ "Content-Type":contentType },body:bytes.buffer as ArrayBuffer }).formData(); }
    catch { throw new ApiError(400,"invalid_upload","The image upload could not be read."); }
    const file = form.get("file");
    if (!(file instanceof File) || file.size < 12 || file.size > 4*1024*1024) throw new ApiError(400,"invalid_upload","Choose an image up to 4 MB.");
    const image = new Uint8Array(await file.arrayBuffer()); const type = imageType(image);
    if (!type || type !== file.type) throw new ApiError(415,"invalid_image","Use a valid JPEG, PNG, or WebP image. SVG files are not accepted.");
    const extension = type === "image/jpeg" ? "jpg" : type === "image/png" ? "png" : "webp";
    const key = `references/${crypto.randomUUID()}.${extension}`;
    const storage = bucket();
    await storage.put(key,image,{ httpMetadata:{ contentType:type,contentDisposition:"inline" },customMetadata:{ owner:user.userId } });
    try { await database().prepare("INSERT INTO uploads (key,user_id,content_type,size,created_at) VALUES (?,?,?,?,?)").bind(key,user.userId,type,file.size,Date.now()).run(); }
    catch (error) { await storage.delete(key); throw error; }
    return json({ key, referenceKey:key, url:`/api/uploads/${encodeURIComponent(key)}` },201);
  });
}
