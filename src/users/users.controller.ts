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
} from '@nestjs/common';
import { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'node:fs';
import * as path from 'node:path';

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
}
