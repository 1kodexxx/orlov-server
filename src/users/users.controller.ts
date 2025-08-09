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
} from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../auth/guards'; // у тебя JwtAuthGuard в auth/guards.ts

type Role = 'admin' | 'manager' | 'customer';
interface JwtPayloadLike {
  sub: number;
  email: string;
  role: Role;
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
