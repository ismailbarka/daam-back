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
import { randomUUID } from 'crypto';
import { OAuth2Client } from 'google-auth-library';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {
    this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
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
      accessToken: this.jwtService.sign(payload),
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
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid Google token');
    }

    if (!payload || !payload.email) {
      throw new UnauthorizedException('Could not retrieve email from Google');
    }

    const { email, sub: googleId } = payload;

    // Check if user exists by Google ID
    let user = await this.usersService.findByGoogleId(googleId);

    if (!user) {
      // Check if a local account with this email already exists
      user = await this.usersService.findByEmail(email);

      if (user) {
        // Link Google to existing account
        user = await this.usersService.update(user.id, {
          googleId,
          emailVerified: true,
          authProvider: 'GOOGLE',
          placementTestCompleted: true,
        });
      } else {
        // Create new account
        user = await this.usersService.create({
          email,
          googleId,
          authProvider: 'GOOGLE',
          emailVerified: true, // Google already verifies email
          placementTestCompleted: true, // Skip placement test for Google users
        });
      }
    }

    const jwtPayload = { email: user.email, sub: user.id };
    const requiresPlacementTest = false;

    return {
      accessToken: this.jwtService.sign(jwtPayload),
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
