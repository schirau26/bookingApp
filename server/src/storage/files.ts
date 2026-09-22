import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { HttpError } from '../middleware/errorHandler.js';

const allowedTypes: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const uploadsDirectory = path.resolve(process.cwd(), 'uploads');
export const uploadsPublicPath = '/uploads';

export function isStoredUpload(url: string) {
  return url.startsWith(`${uploadsPublicPath}/`);
}

export async function saveImage(buffer: Buffer, mimeType: string, folder: string) {
  const extension = allowedTypes[mimeType];
  if (!extension) {
    throw new HttpError(422, 'Upload a JPEG, PNG, or WebP image');
  }
  if (folder.includes('..') || folder.includes('/') || folder.includes('\\')) {
    throw new HttpError(500, 'Invalid upload folder');
  }

  const filename = `${randomUUID()}.${extension}`;
  const directory = path.join(uploadsDirectory, folder);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, filename), buffer);
  return { url: `${uploadsPublicPath}/${folder}/${filename}` };
}

export async function deleteStoredImage(url: string | null | undefined) {
  if (!url || !isStoredUpload(url)) return;

  const relative = url.slice(uploadsPublicPath.length + 1);
  if (relative.includes('..')) return;

  const filePath = path.resolve(uploadsDirectory, relative);
  if (!filePath.startsWith(`${uploadsDirectory}${path.sep}`)) return;

  await unlink(filePath).catch(() => undefined);
}
