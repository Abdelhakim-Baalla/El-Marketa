import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsEnum,
} from 'class-validator';
import { Role } from '@prisma/client';

export class RegisterDto {
  @IsEmail({}, { message: 'Email invalide' })
  @IsNotEmpty({ message: 'Email requis' })
  email: string;

  @IsString({ message: 'Le mot de passe doit être une chaîne' })
  @MinLength(6, {
    message: 'Le mot de passe doit contenir au moins 6 caractères',
  })
  @IsNotEmpty({ message: 'Mot de passe requis' })
  password: string;

  @IsEnum(Role, { message: 'Le rôle doit être ADMIN ou CLIENT' })
  @IsNotEmpty({ message: 'Rôle requis' })
  role: Role;
}
