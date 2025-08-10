// src/auth/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import type { Role } from '../types';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
