/**
 * Read an image file as a JPEG data URL, scaled so its longest side is at most
 * `maxDim` pixels.
 *
 * Phone photos are often 3–8 MB; base64 adds another third, which blows past
 * Vercel's 4.5 MB request-body limit for API routes. Shrinking on the device
 * keeps uploads small and fast and is plenty of detail for species ID.
 *
 * If the browser can't decode the file (e.g. HEIC outside Safari), the original
 * data URL is returned unchanged.
 */
export async function readImageForUpload(file: File, maxDim = 1600, quality = 0.85): Promise<string> {
  const original = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = original;
    });

    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return original;
  }
}
