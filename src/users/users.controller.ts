import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  NotFoundException,
  Res,
  Query,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';

import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ChangeEmailDto } from './dto/change-email.dto';
import { JwtAuthGuard } from '../auth/guards';

type Role = 'admin' | 'manager' | 'customer';
interface JwtPayload {
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
    const payload = req.user as JwtPayload;
    const u = await this.users.getPublicProfile(payload.sub);
    if (!u) throw new NotFoundException('User not found');
    return u;
  }

  @Patch('me')
  async updateMe(@Req() req: Request, @Body() dto: UpdateProfileDto) {
    const payload = req.user as JwtPayload;
    return this.users.updateProfile(payload.sub, dto);
  }

  @Patch('me/email')
  async changeEmail(@Req() req: Request, @Body() dto: ChangeEmailDto) {
    const payload = req.user as JwtPayload;
    return this.users.changeEmail(payload.sub, dto.email);
  }

  @Patch('me/password')
  async changePassword(@Req() req: Request, @Body() dto: ChangePasswordDto) {
    const payload = req.user as JwtPayload;
    await this.users.changePassword(
      payload.sub,
      dto.currentPassword,
      dto.newPassword,
    );
    return { success: true };
  }

  /** multipart/form-data, key=avatar */
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
          const safe = (file.originalname || 'avatar')
            .replace(/[^a-zA-Z0-9._-]+/g, '_')
            .slice(0, 60);
          cb(null, `${ts}-${safe}`);
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
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadAvatar(
    @Req() req: Request,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Файл не получен');
    const payload = req.user as JwtPayload;
    const { avatarUrl } = await this.users.processAndSetAvatar(
      payload.sub,
      file.path,
    );
    const profile = await this.users.getPublicProfile(payload.sub);
    return { avatarUrl, user: profile };
  }

  @Get('me/likes')
  async myLikes(@Req() req: Request) {
    const payload = req.user as JwtPayload;
    return this.users.getMyLikedProducts(payload.sub);
  }

  @Get('me/comments')
  async myComments(@Req() req: Request) {
    const payload = req.user as JwtPayload;
    return this.users.getMyProductComments(payload.sub);
  }

  @Get('me/company-reviews')
  async myCompanyReviews(@Req() req: Request) {
    const payload = req.user as JwtPayload;
    return this.users.getMyCompanyReviews(payload.sub);
  }

  @Get('me/orders')
  async myOrders(@Req() req: Request) {
    const payload = req.user as JwtPayload;
    return this.users.getMyOrders(payload.sub);
  }

  @Get('me/stats')
  async myStats(@Req() req: Request) {
    const payload = req.user as JwtPayload;
    return this.users.getMyStats(payload.sub);
  }

  @Delete('me')
  async deleteMe(@Req() req: Request) {
    const payload = req.user as JwtPayload;
    await this.users.deleteById(payload.sub);
    return { success: true };
  }

  @Delete(':id')
  async adminDelete(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const payload = req.user as JwtPayload;
    if (payload.role !== 'admin')
      throw new ForbiddenException('Admin role required');
    await this.users.deleteById(id);
    return { success: true };
  }

  /**
   * ПУБЛИЧНЫЙ плейсхолдер аватарки (PNG) — без авторизации.
   * URL: /users/avatar/placeholder/:id.png?name=Имя%20Фамилия
   */
  @UseGuards() // переопределяем guard на уровне метода -> публично
  @Get('avatar/placeholder/:id.png')
  async avatarPlaceholder(
    @Param('id') _id: string,
    @Query('name') name: string,
    @Res() res: Response,
  ) {
    const initials = (name || 'User')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join('');

    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#2b2b2b"/>
          <stop offset="1" stop-color="#1a1a1a"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <circle cx="256" cy="256" r="220" fill="#111" opacity="0.65"/>
      <text x="50%" y="52%" font-size="180" font-family="Inter, system-ui, Arial"
            text-anchor="middle" dominant-baseline="middle" fill="#EFE393">${initials}</text>
    </svg>`;

    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600, immutable');
    return res.send(png);
  }
}
