import { put, get, del } from "@vercel/blob";

/** All objects stay private. Application routes decide who can read a photo. */
export function createVercelBucket(): R2Bucket {
  function assertKey(key: string) {
    if (!/^(phones|trade-ins)\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/i.test(key)) throw new Error("Invalid photo key");
  }
  return {
    async put(key: string, bytes: Uint8Array, options?: { httpMetadata?: { contentType?: string } }) {
      assertKey(key);
      return put(key, Buffer.from(bytes), { access: "private", addRandomSuffix: false, allowOverwrite: false,
        contentType: options?.httpMetadata?.contentType, cacheControlMaxAge: 60 });
    },
    async get(key: string) {
      assertKey(key);
      const value = await get(key, { access: "private", useCache: false });
      return value?.statusCode === 200 ? { body: value.stream, size: value.blob.size } : null;
    },
    async delete(keys: string | string[]) {
      for (const key of typeof keys === "string" ? [keys] : keys) assertKey(key);
      await del(keys);
    },
  } as unknown as R2Bucket;
}
