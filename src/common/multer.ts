import { extname } from 'node:path';
import { diskStorage } from 'multer';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

export const avatarMulterOptions: MulterOptions = {
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter(_req, file, cb) {
    if (/^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid image type'), false);
  },
  storage: diskStorage({
    destination: 'uploads/avatars',
    filename: (_req, file, cb) => {
      const name = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, `${name}${extname(file.originalname).toLowerCase()}`);
    },
  }),
};
