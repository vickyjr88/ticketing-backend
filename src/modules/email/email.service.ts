import { Injectable, Logger } from '@nestjs/common';
import * as Brevo from '@getbrevo/brevo';

// Email template types
export enum EmailTemplate {
  ORDER_CONFIRMATION = 'ORDER_CONFIRMATION',
  TICKET_ISSUED = 'TICKET_ISSUED',
  LOTTERY_ENTRY = 'LOTTERY_ENTRY',
  LOTTERY_WIN = 'LOTTERY_WIN',
  LOTTERY_LOSS = 'LOTTERY_LOSS',
  WAITLIST_JOINED = 'WAITLIST_JOINED',
  WAITLIST_NOTIFICATION = 'WAITLIST_NOTIFICATION',
  TICKET_TRANSFER = 'TICKET_TRANSFER',
  TICKET_RECEIVED = 'TICKET_RECEIVED',
  EVENT_REMINDER = 'EVENT_REMINDER',
  WELCOME = 'WELCOME',
  PASSWORD_RESET = 'PASSWORD_RESET',
}

interface EmailParams {
  to: string;
  toName?: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
}

interface OrderEmailData {
  customerName: string;
  customerEmail: string;
  orderId: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  ticketCount: number;
  totalAmount: number;
  currency?: string;
}

interface LotteryEmailData {
  customerName: string;
  customerEmail: string;
  eventTitle: string;
  eventDate: string;
  isWinner: boolean;
  ticketDetails?: string;
}

interface WaitlistEmailData {
  customerName: string;
  customerEmail: string;
  eventTitle: string;
  tierName: string;
  purchaseUrl?: string;
}

interface TicketTransferData {
  senderName: string;
  recipientEmail: string;
  recipientName: string;
  eventTitle: string;
  eventDate: string;
  ticketType: string;
}

interface EventReminderData {
  customerName: string;
  customerEmail: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  ticketCount: number;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiInstance: Brevo.TransactionalEmailsApi;
  private readonly senderEmail = 'tickets@pipita.co.ke';
  private readonly senderName = 'Pipita Tickets';

  constructor() {
    const apiKey = process.env.BREVO_API_KEY;

    if (!apiKey) {
      this.logger.error('BREVO_API_KEY environment variable is not set');
      throw new Error('BREVO_API_KEY environment variable is required');
    }

    this.apiInstance = new Brevo.TransactionalEmailsApi();
    this.apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey);
  }

  /**
   * Send a raw email
   */
  async sendEmail(params: EmailParams): Promise<boolean> {
    try {
      const sendSmtpEmail = new Brevo.SendSmtpEmail();

      sendSmtpEmail.sender = {
        name: this.senderName,
        email: this.senderEmail,
      };

      sendSmtpEmail.to = [{
        email: params.to,
        name: params.toName || params.to,
      }];

      sendSmtpEmail.subject = params.subject;
      sendSmtpEmail.htmlContent = params.htmlContent;

      if (params.textContent) {
        sendSmtpEmail.textContent = params.textContent;
      }

      await this.apiInstance.sendTransacEmail(sendSmtpEmail);
      this.logger.log(`Email sent successfully to ${params.to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${params.to}:`, error);
      return false;
    }
  }

  /**
   * Send order confirmation email
   */
  async sendOrderConfirmation(data: OrderEmailData): Promise<boolean> {
    const html = this.generateOrderConfirmationHtml(data);

    return this.sendEmail({
      to: data.customerEmail,
      toName: data.customerName,
      subject: `🎟️ Order Confirmed - ${data.eventTitle}`,
      htmlContent: html,
    });
  }

  /**
   * Send lottery entry confirmation
   */
  async sendLotteryEntryConfirmation(data: LotteryEmailData): Promise<boolean> {
    const html = this.generateLotteryEntryHtml(data);

    return this.sendEmail({
      to: data.customerEmail,
      toName: data.customerName,
      subject: `🍀 Lottery Entry Confirmed - ${data.eventTitle}`,
      htmlContent: html,
    });
  }

  /**
   * Send lottery result notification
   */
  async sendLotteryResult(data: LotteryEmailData): Promise<boolean> {
    const html = data.isWinner
      ? this.generateLotteryWinHtml(data)
      : this.generateLotteryLossHtml(data);

    return this.sendEmail({
      to: data.customerEmail,
      toName: data.customerName,
      subject: data.isWinner
        ? `🎉 Congratulations! You won tickets to ${data.eventTitle}!`
        : `Lottery Results - ${data.eventTitle}`,
      htmlContent: html,
    });
  }

  /**
   * Send waitlist joined confirmation
   */
  async sendWaitlistJoined(data: WaitlistEmailData): Promise<boolean> {
    const html = this.generateWaitlistJoinedHtml(data);

    return this.sendEmail({
      to: data.customerEmail,
      toName: data.customerName,
      subject: `📋 Waitlist Confirmed - ${data.eventTitle}`,
      htmlContent: html,
    });
  }

  /**
   * Send waitlist notification (tickets available)
   */
  async sendWaitlistNotification(data: WaitlistEmailData): Promise<boolean> {
    const html = this.generateWaitlistNotificationHtml(data);

    return this.sendEmail({
      to: data.customerEmail,
      toName: data.customerName,
      subject: `🚨 Tickets Available! - ${data.eventTitle}`,
      htmlContent: html,
    });
  }

  /**
   * Send ticket transfer notification to sender
   */
  async sendTicketTransferSent(data: TicketTransferData, senderEmail: string): Promise<boolean> {
    const html = this.generateTransferSentHtml(data);

    return this.sendEmail({
      to: senderEmail,
      toName: data.senderName,
      subject: `🎟️ Ticket Transfer Sent - ${data.eventTitle}`,
      htmlContent: html,
    });
  }

  /**
   * Send ticket received notification to recipient
   */
  async sendTicketReceived(data: TicketTransferData): Promise<boolean> {
    const html = this.generateTicketReceivedHtml(data);

    return this.sendEmail({
      to: data.recipientEmail,
      toName: data.recipientName,
      subject: `🎁 You received a ticket to ${data.eventTitle}!`,
      htmlContent: html,
    });
  }

  /**
   * Send event reminder
   */
  async sendEventReminder(data: EventReminderData): Promise<boolean> {
    const html = this.generateEventReminderHtml(data);

    return this.sendEmail({
      to: data.customerEmail,
      toName: data.customerName,
      subject: `⏰ Reminder: ${data.eventTitle} is tomorrow!`,
      htmlContent: html,
    });
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(email: string, name: string): Promise<boolean> {
    const html = this.generateWelcomeHtml(name);

    return this.sendEmail({
      to: email,
      toName: name,
      subject: '🎉 Welcome to Pipita Tickets!',
      htmlContent: html,
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, name: string, token: string): Promise<boolean> {
    const html = this.generatePasswordResetHtml(name, token);

    return this.sendEmail({
      to: email,
      toName: name,
      subject: '🔐 Reset Your Password',
      htmlContent: html,
    });
  }

  // ==================== HTML Templates ====================

  private getBaseTemplate(content: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.6;
      color: #1e293b;
      margin: 0;
      padding: 0;
      background-color: #f1f5f9;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: white;
      padding: 32px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
    }
    .header .emoji {
      font-size: 48px;
      margin-bottom: 16px;
    }
    .content {
      padding: 32px;
    }
    .content h2 {
      color: #1e293b;
      margin-top: 0;
    }
    .info-box {
      background: #f8fafc;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e2e8f0;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .info-label {
      color: #64748b;
      font-size: 14px;
    }
    .info-value {
      font-weight: 600;
      color: #1e293b;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: white;
      padding: 14px 28px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      margin-top: 20px;
    }
    .footer {
      background: #f8fafc;
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
    }
    .highlight {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 4px 12px;
      border-radius: 4px;
      font-weight: 600;
    }
    .winner-box {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border: 2px solid #f59e0b;
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      margin: 20px 0;
    }
    .winner-box h3 {
      color: #92400e;
      margin: 0;
    }
    .alert-box {
      background: #fef2f2;
      border-left: 4px solid #ef4444;
      padding: 16px;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div style="padding: 20px;">
    <div class="container">
      ${content}
      <div class="footer">
        <p>© ${new Date().getFullYear()} Pipita Tickets. All rights reserved.</p>
        <p>If you have any questions, contact us at support@pipita.co.ke</p>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  private generateOrderConfirmationHtml(data: OrderEmailData): string {
    const currency = data.currency || 'KES';
    const content = `
      <div class="header">
        <div class="emoji">🎟️</div>
        <h1>Order Confirmed!</h1>
      </div>
      <div class="content">
        <p>Hi ${data.customerName},</p>
        <p>Great news! Your ticket order has been confirmed. Here are your order details:</p>
        
        <div class="info-box">
          <div class="info-row">
            <span class="info-label">Order ID</span>
            <span class="info-value">${data.orderId.substring(0, 8).toUpperCase()}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Event</span>
            <span class="info-value">${data.eventTitle}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Date</span>
            <span class="info-value">${data.eventDate}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Location</span>
            <span class="info-value">${data.eventLocation}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Tickets</span>
            <span class="info-value">${data.ticketCount} ticket(s)</span>
          </div>
          <div class="info-row">
            <span class="info-label">Total Paid</span>
            <span class="info-value highlight">${currency} ${data.totalAmount.toLocaleString()}</span>
          </div>
        </div>
        
        <p>Your tickets are ready! You can view them in the Pipita app or website.</p>
        
        <center>
          <a href="https://pipita.co.ke/my-tickets" class="button">View My Tickets</a>
        </center>
        
        <p style="margin-top: 24px; font-size: 14px; color: #64748b;">
          Remember to bring your phone to the event for ticket scanning. See you there! 🎉
        </p>
      </div>
    `;
    return this.getBaseTemplate(content);
  }

  private generateLotteryEntryHtml(data: LotteryEmailData): string {
    const content = `
      <div class="header" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
        <div class="emoji">🍀</div>
        <h1>Lottery Entry Confirmed!</h1>
      </div>
      <div class="content">
        <p>Hi ${data.customerName},</p>
        <p>Your entry to the ticket lottery has been confirmed!</p>
        
        <div class="info-box">
          <div class="info-row">
            <span class="info-label">Event</span>
            <span class="info-value">${data.eventTitle}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Date</span>
            <span class="info-value">${data.eventDate}</span>
          </div>
        </div>
        
        <p>We'll notify you by email when the lottery results are announced. Good luck! 🤞</p>
        
        <p style="font-size: 14px; color: #64748b;">
          Note: Lottery winners are selected randomly. Results will be sent to this email address.
        </p>
      </div>
    `;
    return this.getBaseTemplate(content);
  }

  private generateLotteryWinHtml(data: LotteryEmailData): string {
    const content = `
      <div class="header" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
        <div class="emoji">🎉</div>
        <h1>Congratulations, Winner!</h1>
      </div>
      <div class="content">
        <p>Hi ${data.customerName},</p>
        
        <div class="winner-box">
          <h3>🏆 YOU WON! 🏆</h3>
          <p style="margin: 8px 0 0 0; color: #92400e;">You've been selected in the lottery draw!</p>
        </div>
        
        <p>Great news! You've won tickets to <strong>${data.eventTitle}</strong>!</p>
        
        <div class="info-box">
          <div class="info-row">
            <span class="info-label">Event</span>
            <span class="info-value">${data.eventTitle}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Date</span>
            <span class="info-value">${data.eventDate}</span>
          </div>
          ${data.ticketDetails ? `
          <div class="info-row">
            <span class="info-label">Ticket</span>
            <span class="info-value">${data.ticketDetails}</span>
          </div>
          ` : ''}
        </div>
        
        <p>Your tickets have been added to your account. View them anytime in the app!</p>
        
        <center>
          <a href="https://pipita.co.ke/my-tickets" class="button">View My Tickets</a>
        </center>
      </div>
    `;
    return this.getBaseTemplate(content);
  }

  private generateLotteryLossHtml(data: LotteryEmailData): string {
    const content = `
      <div class="header" style="background: linear-gradient(135deg, #64748b 0%, #475569 100%);">
        <div class="emoji">🎫</div>
        <h1>Lottery Results</h1>
      </div>
      <div class="content">
        <p>Hi ${data.customerName},</p>
        <p>Thank you for participating in the lottery for <strong>${data.eventTitle}</strong>.</p>
        
        <p>Unfortunately, you weren't selected as a winner this time. But don't worry – there are always more opportunities!</p>
        
        <p>Keep an eye out for:</p>
        <ul>
          <li>Future lottery draws</li>
          <li>New ticket releases</li>
          <li>Special promotions</li>
        </ul>
        
        <center>
          <a href="https://pipita.co.ke/events" class="button">Browse Upcoming Events</a>
        </center>
      </div>
    `;
    return this.getBaseTemplate(content);
  }

  private generateWaitlistJoinedHtml(data: WaitlistEmailData): string {
    const content = `
      <div class="header" style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);">
        <div class="emoji">📋</div>
        <h1>Waitlist Confirmed</h1>
      </div>
      <div class="content">
        <p>Hi ${data.customerName},</p>
        <p>You've been added to the waitlist!</p>
        
        <div class="info-box">
          <div class="info-row">
            <span class="info-label">Event</span>
            <span class="info-value">${data.eventTitle}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Ticket Type</span>
            <span class="info-value">${data.tierName}</span>
          </div>
        </div>
        
        <p>We'll email you immediately when tickets become available. Be ready to act fast – they go quickly!</p>
        
        <p style="font-size: 14px; color: #64748b;">
          Tip: Keep your payment details ready for a quick checkout.
        </p>
      </div>
    `;
    return this.getBaseTemplate(content);
  }

  private generateWaitlistNotificationHtml(data: WaitlistEmailData): string {
    const content = `
      <div class="header" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);">
        <div class="emoji">🚨</div>
        <h1>Tickets Are Available!</h1>
      </div>
      <div class="content">
        <p>Hi ${data.customerName},</p>
        
        <div class="alert-box" style="background: #fef3c7; border-color: #f59e0b;">
          <strong>⚡ Act Fast!</strong> Tickets for ${data.tierName} are now available!
        </div>
        
        <div class="info-box">
          <div class="info-row">
            <span class="info-label">Event</span>
            <span class="info-value">${data.eventTitle}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Ticket Type</span>
            <span class="info-value">${data.tierName}</span>
          </div>
        </div>
        
        <p>Don't miss out – purchase your tickets now before they sell out again!</p>
        
        <center>
          <a href="${data.purchaseUrl || 'https://pipita.co.ke/events'}" class="button" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);">
            Buy Tickets Now →
          </a>
        </center>
      </div>
    `;
    return this.getBaseTemplate(content);
  }

  private generateTransferSentHtml(data: TicketTransferData): string {
    const content = `
      <div class="header">
        <div class="emoji">🎟️</div>
        <h1>Ticket Transfer Sent</h1>
      </div>
      <div class="content">
        <p>Hi ${data.senderName},</p>
        <p>Your ticket transfer has been completed successfully!</p>
        
        <div class="info-box">
          <div class="info-row">
            <span class="info-label">Event</span>
            <span class="info-value">${data.eventTitle}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Date</span>
            <span class="info-value">${data.eventDate}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Ticket Type</span>
            <span class="info-value">${data.ticketType}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Sent To</span>
            <span class="info-value">${data.recipientName} (${data.recipientEmail})</span>
          </div>
        </div>
        
        <p>The recipient has been notified and the ticket is now in their account.</p>
      </div>
    `;
    return this.getBaseTemplate(content);
  }

  private generateTicketReceivedHtml(data: TicketTransferData): string {
    const content = `
      <div class="header" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
        <div class="emoji">🎁</div>
        <h1>You Received a Ticket!</h1>
      </div>
      <div class="content">
        <p>Hi ${data.recipientName},</p>
        <p><strong>${data.senderName}</strong> has sent you a ticket!</p>
        
        <div class="info-box">
          <div class="info-row">
            <span class="info-label">Event</span>
            <span class="info-value">${data.eventTitle}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Date</span>
            <span class="info-value">${data.eventDate}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Ticket Type</span>
            <span class="info-value">${data.ticketType}</span>
          </div>
        </div>
        
        <p>Your ticket is ready! View it in the app or website.</p>
        
        <center>
          <a href="https://pipita.co.ke/my-tickets" class="button">View My Tickets</a>
        </center>
      </div>
    `;
    return this.getBaseTemplate(content);
  }

  private generateEventReminderHtml(data: EventReminderData): string {
    const content = `
      <div class="header" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
        <div class="emoji">⏰</div>
        <h1>Event Reminder</h1>
      </div>
      <div class="content">
        <p>Hi ${data.customerName},</p>
        <p>Just a friendly reminder – your event is <strong>tomorrow</strong>!</p>
        
        <div class="info-box">
          <div class="info-row">
            <span class="info-label">Event</span>
            <span class="info-value">${data.eventTitle}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Date</span>
            <span class="info-value">${data.eventDate}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Location</span>
            <span class="info-value">${data.eventLocation}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Your Tickets</span>
            <span class="info-value">${data.ticketCount} ticket(s)</span>
          </div>
        </div>
        
        <p><strong>Remember to bring:</strong></p>
        <ul>
          <li>📱 Your phone (for ticket scanning)</li>
          <li>🪪 A valid ID</li>
        </ul>
        
        <center>
          <a href="https://pipita.co.ke/my-tickets" class="button">View My Tickets</a>
        </center>
        
        <p style="margin-top: 24px; text-align: center;">See you there! 🎉</p>
      </div>
    `;
    return this.getBaseTemplate(content);
  }

  private generateWelcomeHtml(name: string): string {
    const content = `
      <div class="header">
        <div class="emoji">🎉</div>
        <h1>Welcome to Pipita!</h1>
      </div>
      <div class="content">
        <p>Hi ${name},</p>
        <p>Welcome to Pipita Tickets – your gateway to amazing events!</p>
        
        <p>With Pipita, you can:</p>
        <ul>
          <li>🎟️ Buy tickets to exclusive events</li>
          <li>🍀 Enter ticket lotteries</li>
          <li>🎁 Transfer tickets to friends</li>
          <li>📱 Access your tickets anywhere</li>
        </ul>
        
        <center>
          <a href="https://pipita.co.ke/events" class="button">Explore Events</a>
        </center>
        
        <p style="margin-top: 24px; font-size: 14px; color: #64748b;">
          Have questions? Reply to this email or contact support@pipita.co.ke
        </p>
      </div>
    `;
    return this.getBaseTemplate(content);
  }

  private generatePasswordResetHtml(name: string, token: string): string {
    // In a real app, this would link to the frontend reset password page
    const resetUrl = `https://pipita.co.ke/auth/reset-password?token=${token}`;

    const content = `
      <div class="header">
        <div class="emoji">🔐</div>
        <h1>Reset Your Password</h1>
      </div>
      <div class="content">
        <p>Hi ${name},</p>
        <p>We received a request to reset your password for your Pipita Tickets account.</p>
        
        <p>If you didn't request this, you can safely ignore this email.</p>
        
        <center>
          <a href="${resetUrl}" class="button">Reset Password</a>
        </center>
        
        <p style="margin-top: 24px; font-size: 14px; color: #64748b;">
          This link will expire in 1 hour.
        </p>
        
        <p style="margin-top: 24px; font-size: 12px; color: #94a3b8; word-break: break-all;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          ${resetUrl}
        </p>
      </div>
    `;
    return this.getBaseTemplate(content);
  }
}
