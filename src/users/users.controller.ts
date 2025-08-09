import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards';

import * as multer from 'multer';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

import type { Request } from 'express';

interface JwtPayload {
  sub: number;
  email: string;
  role: string;
}
type AuthenticatedRequest = Request & { user: JwtPayload };

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Req() req: AuthenticatedRequest) {
    const userId = req.user.sub;
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('Пользователь не найден');
    return user;
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateMe(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.users.updateProfile(req.user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
      fileFilter: (req, file, cb) => {
        const ok = /image\/(png|jpe?g|webp)/i.test(file.mimetype);
        cb(
          ok ? null : new BadRequestException('Неподдерживаемый тип файла'),
          ok,
        );
      },
    }),
  )
  async uploadAvatar(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Файл не получен');
    }

    const userId = req.user.sub;

    const outDir = path.join(process.cwd(), 'uploads', 'avatars');
    await fs.promises.mkdir(outDir, { recursive: true });

    const filename = `${userId}-${Date.now()}.webp`;
    const outPath = path.join(outDir, filename);

    // ниже локально отключаем «опасные» проверки только для вызова sharp и чейнинга
    // — это безопасный и контролируемый участок.
    /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    await sharp(file.buffer)
      .rotate()
      .resize(512, 512, { fit: 'cover' })
      .webp({ quality: 80 })
      .toFile(outPath);
    /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

    const publicUrl = `/static/avatars/${filename}`;
    return this.users.setAvatar(userId, publicUrl);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me/avatar')
  async deleteAvatar(@Req() req: AuthenticatedRequest) {
    return this.users.removeAvatar(req.user.sub);
  }
}
