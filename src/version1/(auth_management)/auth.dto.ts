import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

export class SignInDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}

export class ChangePasswordDto {
  @IsEmail()
  user_email: string;

  @IsString()
  @MinLength(6)
  new_password: string;

  @IsString()
  @IsOptional()
  old_password?: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

export class VerifyOtpDto {
  @IsNotEmpty()
  @IsEmail()
  user_email: string;

  @IsNotEmpty()
  @IsString()
  @Length(6, 6)
  otp_code: string;
}

export class LoginResponseDto {
  email: string;
  fname: string;
  lname: string;
  user_id: string;
}