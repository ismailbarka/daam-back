import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private mailService: MailService,
    private prisma: PrismaService,
  ) {
    this.googleClient = new OAuth2Client(this.getGoogleClientId());
  }

  async register(registerDto: RegisterDto) {
    const { email, password } = registerDto;

    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('An account with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verifyToken = randomUUID();
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.usersService.create({
      email,
      password: hashedPassword,
      emailVerifyToken: verifyToken,
      emailVerifyExpires: verifyExpires,
      // role defaults to STUDENT, emailVerified defaults to false
    });

    await this.mailService.sendVerificationEmail(email, verifyToken);

    return { message: 'Registration successful. Please check your email to verify your account.' };
  }

  async login(loginDto: LoginDto) {
    const { email: identifier, password } = loginDto;

    let user = await this.usersService.findByEmail(identifier);
    if (!user) {
      user = await this.usersService.findByUsername(identifier);
    }

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.emailVerified) {
      throw new ForbiddenException('Please verify your email before logging in');
    }

    const payload = { email: user.email, sub: user.id };
    const requiresPlacementTest = false;

    return {
      ...(await this.createSession(user.id, payload)),
      requiresPlacementTest,
      profileCompleted: user.profileCompleted,
      nextStep: this.getNextStep(user),
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        profileCompleted: user.profileCompleted,
        schoolLevel: user.schoolLevel,
      },
    };
  }

  async verifyEmail(token: string) {
    if (!token) {
      throw new BadRequestException('Verification token is required');
    }

    const user = await this.usersService.findByVerifyToken(token);
    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    if (user.emailVerifyExpires && user.emailVerifyExpires < new Date()) {
      throw new BadRequestException('Verification token has expired. Please request a new one.');
    }

    await this.usersService.update(user.id, {
      emailVerified: true,
      emailVerifyToken: null,
      emailVerifyExpires: null,
    });

    return { message: 'Email verified successfully. You can now log in.' };
  }

  async resendVerification(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      // Return success even if user doesn't exist to prevent email enumeration
      return { message: 'If an account with this email exists, a verification email has been sent.' };
    }

    if (user.emailVerified) {
      return { message: 'Email is already verified.' };
    }

    const verifyToken = randomUUID();
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.usersService.update(user.id, {
      emailVerifyToken: verifyToken,
      emailVerifyExpires: verifyExpires,
    });

    await this.mailService.sendVerificationEmail(user.email, verifyToken);

    return { message: 'If an account with this email exists, a verification email has been sent.' };
  }

  async googleLogin(googleLoginDto: GoogleLoginDto) {
    const { idToken } = googleLoginDto;

    let payload;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: this.getGoogleClientId(),
      });
      payload = ticket.getPayload();
    } catch (err) {
      console.error('Google token verification failed:', err);
      throw new UnauthorizedException('Invalid Google token');
    }

    if (!payload || !payload.email) {
      throw new UnauthorizedException('Could not retrieve email from Google');
    }

    const { email, sub: googleId } = payload;

    try {
      // Check if user exists by Google ID
      let user = await this.usersService.findByGoogleId(googleId);

      if (!user) {
        // Check if a local account with this email already exists
        user = await this.usersService.findByEmail(email);

        if (user) {
          // Link Google to an existing account
          user = await this.usersService.update(user.id, {
            googleId,
            emailVerified: true,
            authProvider: 'GOOGLE',
            placementTestCompleted: true,
          });
        } else {
          // Create a new account. If two callbacks arrive together, recover by
          // reading the account created by the other callback below.
          try {
            user = await this.usersService.create({
              email,
              googleId,
              authProvider: 'GOOGLE',
              emailVerified: true,
              placementTestCompleted: true,
            });
          } catch (error) {
            if (!this.isPrismaConflict(error)) throw error;
            user = await this.usersService.findByGoogleId(googleId) ?? await this.usersService.findByEmail(email);
            if (!user) throw error;
          }
        }
      }

      const jwtPayload = { email: user.email, sub: user.id };
      const requiresPlacementTest = false;

      return {
        ...(await this.createSession(user.id, jwtPayload)),
        requiresPlacementTest,
        profileCompleted: user.profileCompleted,
        nextStep: this.getNextStep(user),
        user: this.publicUser(user),
      };
    } catch (error) {
      console.error('Google account provisioning failed:', error);
      throw new BadRequestException('Google sign-in could not be completed. Please try again.');
    }
  }

  async completeProfile(userId: number, completeProfileDto: CompleteProfileDto) {
    const { username, schoolLevel } = completeProfileDto;

    const existingUser = await this.usersService.findByUsername(username);
    if (existingUser && existingUser.id !== userId) {
      throw new ConflictException('Username is already taken');
    }

    const user = await this.usersService.update(userId, {
      username,
      schoolLevel,
      profileCompleted: true,
      placementTestCompleted: true,
    });

    const requiresPlacementTest = false;

    return {
      profileCompleted: user.profileCompleted,
      nextStep: this.getNextStep(user),
      requiresPlacementTest,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        profileCompleted: user.profileCompleted,
        schoolLevel: user.schoolLevel,
      },
    };
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt <= new Date()) {
      throw new UnauthorizedException('Your session has expired. Please log in again.');
    }

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    const payload = { email: storedToken.user.email, sub: storedToken.user.id };
    return {
      ...(await this.createSession(storedToken.user.id, payload)),
      user: this.publicUser(storedToken.user),
      profileCompleted: storedToken.user.profileCompleted,
      nextStep: this.getNextStep(storedToken.user),
    };
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async createSession(userId: number, payload: { email: string; sub: number }) {
    const refreshToken = randomBytes(48).toString('base64url');
    const refreshTokenExpiresAt = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashToken(refreshToken),
        userId,
        expiresAt: refreshTokenExpiresAt,
      },
    });

    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken,
      refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
    };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private getGoogleClientId() {
    return (
      (process.env.GOOGLE_CLIENT_ID || '').trim().replace(/^['"]|['"]$/g, '') ||
      '283771604701-p0qc84oc0i4jka8qhe3jbgrv6otd2dak.apps.googleusercontent.com'
    );
  }

  private isPrismaConflict(error: unknown) {
    return error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2002';
  }

  private publicUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      profileCompleted: user.profileCompleted,
      schoolLevel: user.schoolLevel,
    };
  }

  private getNextStep(user: {
    role: string;
    profileCompleted: boolean;
    placementTestCompleted: boolean;
  }): string {
    if (!user.profileCompleted) return 'complete-profile';
    if (user.role === 'ADMIN') return 'admin';
    return 'subjects';
  }
}
