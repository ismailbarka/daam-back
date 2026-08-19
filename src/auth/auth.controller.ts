import { Controller, Post, Get, Body, Query, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller()
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('auth/register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('auth/verify-email')
  async verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('auth/resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Body('email') email: string) {
    return this.authService.resendVerification(email);
  }

  @Post('auth/google')
  @HttpCode(HttpStatus.OK)
  async googleLogin(@Body() googleLoginDto: GoogleLoginDto) {
    return this.authService.googleLogin(googleLoginDto);
  }

  @Post('auth/refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refresh(refreshTokenDto.refreshToken);
  }

  @Post('auth/logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() refreshTokenDto: RefreshTokenDto) {
    await this.authService.logout(refreshTokenDto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('auth/complete-profile')
  @HttpCode(HttpStatus.OK)
  async completeProfile(@Request() req, @Body() completeProfileDto: CompleteProfileDto) {
    return this.authService.completeProfile(req.user.id, completeProfileDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Request() req) {
    return req.user;
  }

  @Post('auth/make-admin')
  @HttpCode(HttpStatus.OK)
  async makeAdmin(@Body() body: { identifier: string; secret: string }) {
    return this.authService.promoteToAdmin(body.identifier, body.secret);
  }
}
