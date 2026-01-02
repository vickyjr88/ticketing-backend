import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContactMessage, ContactMessageStatus, ContactSubject } from '../../entities/contact-message.entity';
import { CreateContactMessageDto, UpdateContactMessageDto, ReplyContactMessageDto, ContactQueryDto } from './dto/contact.dto';
import { EmailService } from '../email/email.service';

@Injectable()
export class ContactService {
    private readonly logger = new Logger(ContactService.name);

    constructor(
        @InjectRepository(ContactMessage)
        private contactRepository: Repository<ContactMessage>,
        private emailService: EmailService,
    ) { }

    // Submit a new contact message (public)
    async createMessage(
        dto: CreateContactMessageDto,
        ipAddress?: string,
        userAgent?: string,
    ): Promise<ContactMessage> {
        const message = this.contactRepository.create({
            ...dto,
            subject: dto.subject || ContactSubject.GENERAL,
            ip_address: ipAddress,
            user_agent: userAgent,
        });

        const saved = await this.contactRepository.save(message);

        // Send notification email to admin
        await this.sendAdminNotification(saved);

        // Send confirmation email to user
        await this.sendUserConfirmation(saved);

        this.logger.log(`New contact message received from ${dto.email}`);

        return saved;
    }

    // Get all messages with filters (admin)
    async findAll(query: ContactQueryDto) {
        const { status, subject, page = 1, limit = 20 } = query;

        const qb = this.contactRepository.createQueryBuilder('msg');

        if (status) {
            qb.andWhere('msg.status = :status', { status });
        }

        if (subject) {
            qb.andWhere('msg.subject = :subject', { subject });
        }

        qb.orderBy('msg.created_at', 'DESC');
        qb.skip((page - 1) * limit).take(limit);

        const [messages, total] = await qb.getManyAndCount();

        return {
            messages,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasNextPage: page * limit < total,
                hasPrevPage: page > 1,
            },
        };
    }

    // Get single message (admin)
    async findOne(id: string): Promise<ContactMessage> {
        const message = await this.contactRepository.findOne({ where: { id } });
        if (!message) {
            throw new NotFoundException('Contact message not found');
        }
        return message;
    }

    // Update message status/notes (admin)
    async update(id: string, dto: UpdateContactMessageDto): Promise<ContactMessage> {
        const message = await this.findOne(id);
        Object.assign(message, dto);
        return this.contactRepository.save(message);
    }

    // Mark as read (admin)
    async markAsRead(id: string): Promise<ContactMessage> {
        const message = await this.findOne(id);
        if (message.status === ContactMessageStatus.NEW) {
            message.status = ContactMessageStatus.READ;
            return this.contactRepository.save(message);
        }
        return message;
    }

    // Reply to message (admin)
    async replyToMessage(
        id: string,
        dto: ReplyContactMessageDto,
        adminId: string,
    ): Promise<ContactMessage> {
        const message = await this.findOne(id);

        // Send reply email
        const emailSent = await this.sendReplyEmail(message, dto.reply_message);

        if (emailSent) {
            message.status = ContactMessageStatus.REPLIED;
            message.replied_by = adminId;
            message.replied_at = new Date();
            await this.contactRepository.save(message);
        }

        return message;
    }

    // Archive message (admin)
    async archive(id: string): Promise<ContactMessage> {
        const message = await this.findOne(id);
        message.status = ContactMessageStatus.ARCHIVED;
        return this.contactRepository.save(message);
    }

    // Delete message (admin)
    async delete(id: string): Promise<void> {
        const message = await this.findOne(id);
        await this.contactRepository.remove(message);
    }

    // Get stats (admin)
    async getStats() {
        const stats = await this.contactRepository
            .createQueryBuilder('msg')
            .select('msg.status', 'status')
            .addSelect('COUNT(*)', 'count')
            .groupBy('msg.status')
            .getRawMany();

        const total = await this.contactRepository.count();
        const newCount = stats.find(s => s.status === ContactMessageStatus.NEW)?.count || 0;

        return {
            total,
            new: parseInt(newCount),
            byStatus: stats.reduce((acc, s) => {
                acc[s.status] = parseInt(s.count);
                return acc;
            }, {}),
        };
    }

    // Send admin notification email
    private async sendAdminNotification(message: ContactMessage): Promise<void> {
        try {
            const adminEmail = process.env.ADMIN_EMAIL || 'triklecamp@gmail.com';
            const subjectLabel = message.subject.replace('_', ' ');

            const html = `
        <h2>New Contact Form Submission</h2>
        <p><strong>From:</strong> ${message.name} (${message.email})</p>
        <p><strong>Phone:</strong> ${message.phone || 'Not provided'}</p>
        <p><strong>Subject:</strong> ${subjectLabel}</p>
        <p><strong>Message:</strong></p>
        <blockquote style="background: #f5f5f5; padding: 15px; border-left: 4px solid #2563eb;">
          ${message.message.replace(/\n/g, '<br>')}
        </blockquote>
        <p><a href="${process.env.FRONTEND_URL || 'https://tickets.vitaldigitalmedia.net'}/admin/contacts/${message.id}">
          View in Admin Dashboard
        </a></p>
      `;

            await this.emailService.sendEmail({
                to: adminEmail,
                subject: `📬 New Contact: ${subjectLabel} from ${message.name}`,
                htmlContent: html,
            });
        } catch (error) {
            this.logger.error('Failed to send admin notification', error);
        }
    }

    // Send user confirmation email
    private async sendUserConfirmation(message: ContactMessage): Promise<void> {
        try {
            const html = this.generateConfirmationHtml(message);

            await this.emailService.sendEmail({
                to: message.email,
                toName: message.name,
                subject: '✅ We received your message - Pipita Tickets',
                htmlContent: html,
            });
        } catch (error) {
            this.logger.error('Failed to send user confirmation', error);
        }
    }

    // Send reply email to user
    private async sendReplyEmail(message: ContactMessage, replyContent: string): Promise<boolean> {
        try {
            const html = this.generateReplyHtml(message, replyContent);

            return await this.emailService.sendEmail({
                to: message.email,
                toName: message.name,
                subject: `Re: ${message.subject.replace('_', ' ')} - Pipita Tickets`,
                htmlContent: html,
            });
        } catch (error) {
            this.logger.error('Failed to send reply email', error);
            return false;
        }
    }

    private generateConfirmationHtml(message: ContactMessage): string {
        return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f1f5f9; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
    .header { background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); color: white; padding: 32px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 32px; }
    .message-box { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #2563eb; }
    .footer { background: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div style="padding: 20px;">
    <div class="container">
      <div class="header">
        <div style="font-size: 48px; margin-bottom: 16px;">✉️</div>
        <h1>Message Received!</h1>
      </div>
      <div class="content">
        <p>Hi ${message.name},</p>
        <p>Thank you for contacting Pipita Tickets! We've received your message and will get back to you as soon as possible.</p>
        
        <div class="message-box">
          <p style="margin: 0 0 10px 0;"><strong>Your message:</strong></p>
          <p style="margin: 0; color: #475569;">${message.message.replace(/\n/g, '<br>')}</p>
        </div>
        
        <p>Our team typically responds within 24-48 hours during business days.</p>
        <p>In the meantime, you might find answers to common questions on our website.</p>
        
        <p style="margin-top: 24px;">Best regards,<br><strong>The Pipita Tickets Team</strong></p>
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} Pipita Tickets. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
    }

    private generateReplyHtml(message: ContactMessage, replyContent: string): string {
        return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f1f5f9; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 32px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 32px; }
    .reply-box { background: #f0fdf4; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #10b981; }
    .original-box { background: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 14px; color: #64748b; }
    .footer { background: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div style="padding: 20px;">
    <div class="container">
      <div class="header">
        <div style="font-size: 48px; margin-bottom: 16px;">💬</div>
        <h1>Response from Pipita</h1>
      </div>
      <div class="content">
        <p>Hi ${message.name},</p>
        <p>Thank you for reaching out to us. Here's our response to your inquiry:</p>
        
        <div class="reply-box">
          ${replyContent.replace(/\n/g, '<br>')}
        </div>
        
        <div class="original-box">
          <p style="margin: 0 0 8px 0;"><strong>Your original message:</strong></p>
          <p style="margin: 0;">${message.message.replace(/\n/g, '<br>')}</p>
        </div>
        
        <p>If you have any further questions, feel free to reply to this email.</p>
        
        <p style="margin-top: 24px;">Best regards,<br><strong>The Pipita Tickets Team</strong></p>
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} Pipita Tickets. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
    }
}
