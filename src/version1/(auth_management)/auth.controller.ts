import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  SignInDto,
  VerifyOtpDto,
} from './auth.dto';
import { Request, Response } from 'express';
import { AccessTokenGuard } from './guards/access-token.guard';
import { GoogleOAuthGuard } from './guards/google-oauth.guard';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post()
  login(@Body() signInDto: SignInDto, @Res() response: Response) {
    return this.authService.signIn(signInDto, response);
  }

  @Get('me')
  getAuthCookie(@Req() req: Request) {
    const authCookie = req.cookies['auth-cookie'];
    if (!authCookie) {
      return { user: null };
    }

    try {
      const parsed =
        typeof authCookie === 'string' ? JSON.parse(authCookie) : authCookie;
      return { user: parsed };
    } catch {
      return { user: null };
    }
  }

  @Get('logout')
  logout(@Res() res: Response) {
    return this.authService.logout(res);
  }

  @Post('forgot-password')
  forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
    @Res() response: Response,
  ) {
    return this.authService.forgotPassword(forgotPasswordDto, response);
  }

  @Put('change-password')
  @UseGuards(AccessTokenGuard)
  changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @Res() response: Response,
  ) {
    return this.authService.changePassword(changePasswordDto, response);
  }

  @Post('verify-otp')
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    const result = await this.authService.verifyOtp(verifyOtpDto);
    if (!result) {
      throw new BadRequestException('Invalid or expired OTP');
    }
    return {
      status: 'Success',
      message: 'OTP verified successfully',
    };
  }

  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  async googleAuth(@Req() req: Request) {
    // This route will redirect to Google
  }

  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  async googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');

    try {
      const user = req.user as any;
      return this.authService.googleLogin(user, res);
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      return res.redirect(`${frontendUrl}/auth?status=failed`);
    }
  }
}
