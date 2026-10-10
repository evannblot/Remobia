export const MAX_PHONE_PHOTOS = 4;
export const MAX_PHOTO_UPLOAD_BYTES = 900 * 1024;
export const MAX_PHOTO_INPUT_BYTES = 25 * 1024 * 1024;
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const JPEG_QUALITIES = [.86, .76, .64, .52];

export function validatePhonePhoto(file: Pick<File, "type" | "size">): void {
  if (!PHOTO_TYPES.has(file.type)) throw new Error("Choisissez une photo JPEG, PNG ou WebP. Pour une photo HEIC, exportez-la d’abord en JPEG.");
  if (!file.size) throw new Error("Ce fichier est vide. Choisissez une autre photo.");
  if (file.size > MAX_PHOTO_INPUT_BYTES) throw new Error("Cette photo est trop volumineuse. Exportez une version plus petite (25 Mo maximum avant optimisation).");
}

function checkCancellation(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Préparation annulée", "AbortError");
}

async function encodeJpeg(canvas: HTMLCanvasElement, quality: number, signal?: AbortSignal): Promise<Blob> {
  checkCancellation(signal);
  return new Promise((resolve, reject) => {
    const cancel = () => reject(new DOMException("Préparation annulée", "AbortError"));
    signal?.addEventListener("abort", cancel, { once: true });
    try {
      canvas.toBlob((blob) => {
        signal?.removeEventListener("abort", cancel);
        if (signal?.aborted) { cancel(); return; }
        if (!blob || blob.type !== "image/jpeg") { reject(new Error("Cette photo ne peut pas être préparée. Essayez avec un autre fichier ou navigateur.")); return; }
        resolve(blob);
      }, "image/jpeg", quality);
    } catch (error) { signal?.removeEventListener("abort", cancel); reject(error); }
  });
}

/** Always re-encode: remove metadata, preserve useful detail and bound a four-photo upload. */
export async function preparePhonePhoto(file: File, signal?: AbortSignal): Promise<File> {
  validatePhonePhoto(file);
  checkCancellation(signal);
  const originalUrl = URL.createObjectURL(file);
  const image = new Image();
  const canvas = document.createElement("canvas");
  const cancelDecode = () => { image.src = ""; };
  signal?.addEventListener("abort", cancelDecode, { once: true });
  try {
    image.src = originalUrl;
    await image.decode();
    checkCancellation(signal);
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("Cette photo ne peut pas être lue. Essayez une autre image.");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Votre navigateur ne peut pas préparer cette photo. Essayez avec un autre navigateur.");
    let longestEdge = Math.min(1600, Math.max(image.naturalWidth, image.naturalHeight));
    while (longestEdge >= 320) {
      const ratio = Math.min(1, longestEdge / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
      context.fillStyle = "#F6F1E8";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of JPEG_QUALITIES) {
        const blob = await encodeJpeg(canvas, quality, signal);
        if (blob.size > 0 && blob.size <= MAX_PHOTO_UPLOAD_BYTES) return new File([blob], "photo-telephone.jpg", { type: "image/jpeg" });
      }
      longestEdge = Math.floor(longestEdge * .8);
    }
    // Tiny originals must also pass through the metadata-removing encoder.
    if (Math.max(image.naturalWidth, image.naturalHeight) < 320) {
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      context.fillStyle = "#F6F1E8";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      const blob = await encodeJpeg(canvas, JPEG_QUALITIES[0], signal);
      if (blob.size > 0 && blob.size <= MAX_PHOTO_UPLOAD_BYTES) return new File([blob], "photo-telephone.jpg", { type: "image/jpeg" });
    }
    throw new Error("Cette photo reste trop volumineuse après optimisation. Choisissez une image plus petite.");
  } catch (error) {
    checkCancellation(signal);
    if (error instanceof Error && error.name !== "EncodingError" && error.name !== "InvalidStateError") throw error;
    throw new Error("Cette photo ne peut pas être lue. Choisissez un autre fichier JPEG, PNG ou WebP.");
  } finally {
    signal?.removeEventListener("abort", cancelDecode);
    image.src = "";
    canvas.width = 1; canvas.height = 1;
    URL.revokeObjectURL(originalUrl);
  }
}
