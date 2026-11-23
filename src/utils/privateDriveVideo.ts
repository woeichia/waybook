import { familyRead } from './familyAccess';

/** Experimental family-authenticated private Drive retrieval via Apps Script.
 * Never sends Google OAuth tokens or Drive API URLs to family devices.
 * Only registered video IDs belonging to the Waybook video folder are accepted.
 */
const CHUNK_BYTES = 256 * 1024;
export const PILOT_MAX_VIDEO_BYTES = 8 * 1024 * 1024;

type ChunkResponse = {
  base64: string;
  start: number;
  end: number;
  total: number;
  mimeType: string;
};

function decodeBase64(value: string): Uint8Array {
  const decoded = atob(value);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
  return bytes;
}

export async function downloadPrivateDriveVideo(
  stopId: string,
  expectedSize: number,
  onProgress: (percentage: number) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  if (!Number.isSafeInteger(expectedSize) || expectedSize < 1 || expectedSize > PILOT_MAX_VIDEO_BYTES) {
    throw new Error('此測試目前支援 8 MB 以下的已登錄影片；較大的影片仍可使用原本的 Drive 播放方式。');
  }
  if (!/^[a-zA-Z0-9_-]{1,110}$/.test(stopId)) throw new Error('活動識別碼無效');
  const parts: Uint8Array[] = [];
  let mime = '';
  for (let start = 0; start < expectedSize; start += CHUNK_BYTES) {
    if (signal?.aborted) throw new Error('已取消影片下載');
    const response = await familyRead<ChunkResponse>({action: 'videoChunk', stopId, start: String(start)}, 40000);
    if (signal?.aborted) throw new Error('已取消影片下載');
    const end = Math.min(start + CHUNK_BYTES, expectedSize) - 1;
    if (response.start !== start || response.end !== end || response.total !== expectedSize) {
      throw new Error('影片資料區段不一致，已停止下載以避免損壞');
    }
    const data = decodeBase64(response.base64);
    if (data.length !== end - start + 1) throw new Error('影片資料不完整，請稍後重試');
    if (mime && mime !== response.mimeType) throw new Error('影片格式不一致');
    mime = response.mimeType;
    parts.push(data);
    onProgress(Math.round(((end + 1) / expectedSize) * 100));
  }
  if (!/^video\/(mp4|webm|quicktime)$/i.test(mime)) throw new Error('目前不支援此影片格式');
  return new Blob(parts as BlobPart[], {type: mime});
}
