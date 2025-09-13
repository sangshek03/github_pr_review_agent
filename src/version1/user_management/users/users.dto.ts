import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  IsBoolean,
} from 'class-validator';
import { Exclude } from 'class-transformer';

export class CreateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  f_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  l_name?: string;

  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(255)
  password?: string;

  @IsOptional()
  @IsString()
  avatar_url?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  f_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  l_name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsBoolean()
  email_verified?: boolean;

  @IsOptional()
  @IsString()
  avatar_url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(255)
  password?: string;
}

export class UserResponseDto {
  user_id: string;
  f_name: string;
  l_name: string;
  email: string;
  email_verified: boolean;
  avatar_url: string;
  phone: string;
  created_at: Date;
  updated_at: Date;

  @Exclude()
  password: string;

  @Exclude()
  refresh_token: string;

  @Exclude()
  deleted_at: Date;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}
