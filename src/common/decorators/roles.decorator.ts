import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/** RolesGuard ile birlikte kullanılır: @Roles('Admin') / @Roles('Admin','Reporter'). */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
