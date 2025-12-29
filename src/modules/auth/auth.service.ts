import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { User } from '../../entities/user.entity';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) { }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && (await bcrypt.compare(password, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: User) {
    const payload = { email: user.email, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
      },
    };
  }

  async register(userData: {
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
    phone_number?: string;
  }) {
    // Hash password
    const hashedPassword = await bcrypt.hash(userData.password, 10);

    // Create user
    const user = await this.usersService.create({
      ...userData,
      password: hashedPassword,
    });

    // Send welcome email (async, don't block registration)
    this.emailService.sendWelcomeEmail(
      user.email,
      user.first_name || user.email.split('@')[0],
    ).catch(err => console.error('Failed to send welcome email:', err));

    // Return token
    return this.login(user);
  }

  async validateToken(token: string): Promise<any> {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      // Don't leak user existence
      return;
    }

    // Generate token
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date();
    expires.setHours(expires.getHours() + 1); // 1 hour expiration

    // Save token to user
    await this.usersService.update(user.id, {
      reset_password_token: token,
      reset_password_expires: expires,
    });

    // Send email
    await this.emailService.sendPasswordResetEmail(
      user.email,
      user.first_name || 'User',
      token,
    );
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await this.usersService.findByResetToken(token);

    if (!user) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    if (!user.reset_password_expires || user.reset_password_expires < new Date()) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    // Set new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.usersService.update(user.id, {
      password: hashedPassword,
      reset_password_token: null,
      reset_password_expires: null,
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.usersService.findById(userId);

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid current password');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.usersService.update(userId, { password: hashedPassword });
  }
}
