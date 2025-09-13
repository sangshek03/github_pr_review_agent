import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../user_management/users/users.service';
import * as bcrypt from 'bcrypt';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  SignInDto,
  VerifyOtpDto,
  LoginResponseDto,
} from './auth.dto';
import { Response } from 'express';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async signIn(signInDto: SignInDto, res: Response) {
    const { email, password } = signInDto;
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new BadRequestException('User not found. Please register first');
    }

    if (!user.password) {
      throw new BadRequestException('User has no password set');
    }

    const isPasswordValid = await this.usersService.validatePassword(
      password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.user_id);

    const auth_data = {
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
      user_id: user.user_id,
      user_verified: true,
    };

    res.cookie('auth-cookie', auth_data, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const response: LoginResponseDto = {
      email: user.email,
      fname: user.f_name,
      lname: user.l_name,
      user_id: user.user_id,
    };

    return res.status(200).json({
      status: 'Success',
      message: 'User successfully logged in',
      userDetails: response,
    });
  }

  async logout(res: Response) {
    res.clearCookie('auth-cookie');
    return res.json({
      status: 'Success',
      message: 'Logout successful',
    });
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto, res: Response) {
    const { email } = forgotPasswordDto;
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new BadRequestException('User not found. Please register first');
    }

    // TODO: Implement OTP generation and email sending
    // For now, just return success message

    res.json({
      status: 'Success',
      message: `Password reset instructions have been sent to ${user.email}`,
    });
  }

  async changePassword(changePasswordDto: ChangePasswordDto, res: Response) {
    const { user_email, new_password, old_password } = changePasswordDto;

    const user = await this.usersService.findByEmail(user_email);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (old_password && user.password) {
      const isPasswordValid = await this.usersService.validatePassword(
        old_password,
        user.password,
      );
      if (!isPasswordValid) {
        throw new BadRequestException('Old password is incorrect');
      }
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);
    await this.usersService.update(user.user_id, { password: hashedPassword });

    res.json({
      status: 'Success',
      message: 'Password updated successfully',
    });
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto): Promise<boolean> {
    const { user_email, otp_code } = verifyOtpDto;

    const user = await this.usersService.findByEmail(user_email);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // TODO: Implement OTP verification logic
    // For now, just return true if OTP is "123456"
    if (otp_code === '123456') {
      return true;
    }

    throw new BadRequestException('Invalid or expired OTP');
  }

  private async generateTokens(userId: string) {
    const payload = { sub: userId, username: userId };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_ACCESS_SECRET || 'your-jwt-access-secret-key',
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET || 'your-jwt-refresh-secret-key',
        expiresIn: '7d',
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }
}
