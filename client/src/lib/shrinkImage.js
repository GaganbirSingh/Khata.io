// Phone cameras make 3–12 MB photos. Hosting platforms cap request size
// (Vercel: 4.5 MB per request), and Gemini reads a 2000 px page just as well,
// so the photo is resized and re-encoded as JPEG in the browser before upload.
// This also strips EXIF data (location, phone model) from the photo.

export const UPLOAD_LIMIT = 4 * 1024 * 1024; // keep below Vercel's 4.5 MB with room for the form fields

const STEPS = [
  { side: 2000, quality: 0.85 },
  { side: 1600, quality: 0.8 },
  { side: 1280, quality: 0.75 },
];

async function decode(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* fall through to <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function encode(source, side, quality) {
  const w = source.width;
  const h = source.height;
  const scale = Math.min(1, side / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; // transparent PNGs become white, not black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

// Returns a JPEG File no larger than UPLOAD_LIMIT, or null if the browser
// cannot read the photo (for example some HEIC files on desktop browsers).
export async function shrinkImage(file) {
  let source;
  try {
    source = await decode(file);
  } catch {
    return null;
  }
  try {
    for (const { side, quality } of STEPS) {
      const blob = await encode(source, side, quality);
      if (blob && blob.size <= UPLOAD_LIMIT) {
        const name = (file.name || 'khata-page').replace(/\.[^.]+$/, '') + '.jpg';
        return new File([blob], name, { type: 'image/jpeg' });
      }
    }
    return null;
  } finally {
    source.close?.();
  }
}
