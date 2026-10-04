import "server-only";
import { postgresDatabase } from "./postgres-store";
import { storageClient } from "./supabase-server";
const referenceBucket = () => storageClient().storage.from(process.env.SUPABASE_STORAGE_BUCKET || "cake-references");
const privateStorage = {
  async put(key: string, body: Uint8Array, options: { httpMetadata: { contentType: string; contentDisposition?: string }; customMetadata?: Record<string, string> }) {
    const { error } = await referenceBucket().upload(key, body, { contentType: options.httpMetadata.contentType, upsert: false });
    if (error) throw new Error("Reference image upload failed");
  },
  async get(key: string) {
    const { data, error } = await referenceBucket().download(key);
    if (error || !data) return null;
    return { body: data.stream() };
  },
  async delete(key: string) {
    const { error } = await referenceBucket().remove([key]);
    if (error) throw new Error("Reference image cleanup failed");
  },
};
export const env = {
  get DB() { return process.env.DATABASE_URL ? postgresDatabase : undefined; },
  get BUCKET() { return process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY ? privateStorage : undefined; },
  get OWNER_EMAIL() { return process.env.OWNER_EMAIL; },
  get OWNER_USER_ID() { return process.env.OWNER_USER_ID; },
};
