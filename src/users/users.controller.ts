// src/users/users.controller.ts
import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  ForbiddenException,
  ParseIntPipe,
  NotFoundException,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../auth/guards';

import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'node:fs';
import * as path from 'node:path';

type Role = 'admin' | 'manager' | 'customer';
interface JwtPayloadLike {
  sub: number;
  email: string;
  role: Role;
}

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  async me(@Req() req: Request) {
    const payload = req.user as JwtPayloadLike;
    const user = await this.users.findById(payload.sub);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  @Patch('me')
  async updateMe(@Req() req: Request, @Body() dto: UpdateProfileDto) {
    const payload = req.user as JwtPayloadLike;
    return this.users.updateProfile(payload.sub, dto);
  }

  @Patch('me/password')
  async changeMyPassword(@Req() req: Request, @Body() dto: ChangePasswordDto) {
    const payload = req.user as JwtPayloadLike;
    await this.users.changePassword(
      payload.sub,
      dto.currentPassword,
      dto.newPassword,
    );
    return { success: true };
  }

  /** Загрузка аватара (multipart/form-data, key=avatar) */
  @Patch('me/avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dest = path.join(process.cwd(), 'uploads', 'avatars');
          ensureDir(dest);
          cb(null, dest);
        },
        filename: (_req, file, cb) => {
          const ts = Date.now();
          const safeBase = (file.originalname || 'avatar')
            .replace(/[^a-zA-Z0-9._-]+/g, '_')
            .slice(0, 60);
          cb(null, `${ts}-${safeBase}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype?.startsWith('image/')) {
          return cb(
            new BadRequestException('Файл должен быть изображением'),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  async uploadAvatar(
    @Req() req: Request,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Файл не получен');
    const payload = req.user as JwtPayloadLike;
    const { avatarUrl } = await this.users.processAndSetAvatar(
      payload.sub,
      file.path,
    );
    return { avatarUrl };
  }

  @Delete('me')
  async deleteMe(@Req() req: Request) {
    const payload = req.user as JwtPayloadLike;
    await this.users.deleteById(payload.sub);
    return { success: true };
  }

  @Delete(':id')
  async adminDelete(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const payload = req.user as JwtPayloadLike;
    if (payload.role !== 'admin')
      throw new ForbiddenException('Admin role required');
    await this.users.deleteById(id);
    return { success: true };
  }
}
