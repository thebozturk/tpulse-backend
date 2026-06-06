import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

/** role schema'da string; geçerli değerler User|Admin (RBAC). */
export const USER_ROLES = ['User', 'Admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export class AdminUpdateRoleDto {
  @ApiProperty({ enum: USER_ROLES, example: 'Admin' })
  @IsIn(USER_ROLES)
  role: UserRole;
}
