import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
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
import { Response } from 'express';
import { AccessTokenGuard } from './guards/access-token.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @HttpCode(HttpStatus.OK)
  @Post()
  login(@Body() signInDto: SignInDto, @Res() response: Response) {
    return this.authService.signIn(signInDto, response);
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
}