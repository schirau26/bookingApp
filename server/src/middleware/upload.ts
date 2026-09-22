import type { RequestHandler } from 'express';
import multer from 'multer';
import { HttpError } from './errorHandler.js';

const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!allowed.has(file.mimetype)) {
      callback(new HttpError(422, 'Upload a JPEG, PNG, or WebP image'));
      return;
    }
    callback(null, true);
  },
});

export function imageUpload(field: string): RequestHandler {
  const middleware = upload.single(field);

  return (req, res, next) => {
    middleware(req, res, (error: unknown) => {
      if (!error) {
        next();
        return;
      }
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        next(new HttpError(422, 'Image must be 5 MB or smaller'));
        return;
      }
      next(error);
    });
  };
}
