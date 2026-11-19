const CUSTOM_PHOTOS_STORAGE_KEY = 'waybook_custom_photos_v1';

export function loadCustomPhotos(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CUSTOM_PHOTOS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string' && v.startsWith('data:image/')) {
        out[k] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function saveCustomPhotosMap(photos: Record<string, string>): boolean {
  try {
    localStorage.setItem(CUSTOM_PHOTOS_STORAGE_KEY, JSON.stringify(photos));
    return true;
  } catch {
    return false;
  }
}

export function getCustomPhotoForStop(stopId?: string): string | null {
  if (!stopId) return null;
  const photos = loadCustomPhotos();
  return photos[stopId] ?? null;
}

export async function compressImageToDataUrl(
  file: File,
  maxDimension = 1024,
  quality = 0.78
): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('無法讀取此圖片檔案，請選擇其他照片。'));
      image.src = objectUrl;
    });

    const srcWidth = img.naturalWidth || img.width;
    const srcHeight = img.naturalHeight || img.height;
    if (!srcWidth || !srcHeight) {
      throw new Error('圖片尺寸無效。');
    }

    const scale = Math.min(1, maxDimension / Math.max(srcWidth, srcHeight));
    const targetWidth = Math.max(1, Math.round(srcWidth * scale));
    const targetHeight = Math.max(1, Math.round(srcHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('瀏覽器不支援圖片壓縮處理。');
    }

    ctx.fillStyle = '#F4F2ED';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
