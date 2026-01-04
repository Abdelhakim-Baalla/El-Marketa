import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Email invalide' })
  @IsNotEmpty({ message: 'Email requis' })
  email: string;

  @IsString({ message: 'Le mot de passe doit être une chaîne' })
  @IsNotEmpty({ message: 'Mot de passe requis' })
  password: string;
}
