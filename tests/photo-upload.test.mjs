import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_PHONE_PHOTOS, MAX_PHOTO_INPUT_BYTES, MAX_PHOTO_UPLOAD_BYTES,
  preparePhonePhoto, validatePhonePhoto,
} from "../app/lib/photo-upload.ts";

test("original phone photos accept JPEG, PNG and WebP and reject empty, oversized or unsupported files", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"]) {
    assert.doesNotThrow(() => validatePhonePhoto({ type, size: MAX_PHOTO_INPUT_BYTES }));
    assert.throws(() => validatePhonePhoto({ type, size: 0 }), /vide/);
    assert.throws(() => validatePhonePhoto({ type, size: MAX_PHOTO_INPUT_BYTES + 1 }), /25 Mo/);
  }
  for (const type of ["image/heic", "image/svg+xml", "application/pdf", ""]) {
    assert.throws(() => validatePhonePhoto({ type, size: 100 }), /JPEG, PNG ou WebP/);
  }
});

test("canceling before preparation never allocates browser image resources", async () => {
  const controller = new AbortController();
  controller.abort();
  // Node has no canvas or Image: this proves cancellation occurs before decoding.
  await assert.rejects(preparePhonePhoto(new File(["test"], "photo.jpg", { type: "image/jpeg" }), controller.signal), { name: "AbortError" });
});

test("four maximum-size optimized photos and the complete form fit a 4 MiB request", async () => {
  const form = new FormData();
  form.set("details", JSON.stringify({ brand: "a".repeat(80), model: "b".repeat(100), description: "é".repeat(3000), repairs: "é".repeat(1500), name: "é".repeat(80), email: "a".repeat(250), phone: "0".repeat(30) }));
  for (let index = 0; index < MAX_PHONE_PHOTOS; index++) {
    form.append(index === 0 ? "frontPhoto" : index === 1 ? "backPhoto" : "additionalPhotos", new File([new Uint8Array(MAX_PHOTO_UPLOAD_BYTES)], "photo-telephone.jpg", { type: "image/jpeg" }));
  }
  const request = new Request("https://example.test/api/trade-ins", { method: "POST", body: form });
  const bytes = await request.arrayBuffer();
  assert.ok(bytes.byteLength < 4 * 1024 * 1024, `Multipart request used ${bytes.byteLength} bytes`);
});
