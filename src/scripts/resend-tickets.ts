/**
 * Resend ticket emails (with QR codes) to every current ticket holder.
 *
 * Production (Linux server, Docker). Env is already in the container.
 *
 *   docker exec -it ticketing-backend node dist/scripts/resend-tickets.js --list-events
 *   docker exec -it ticketing-backend node dist/scripts/resend-tickets.js --event-id <uuid>
 *   docker exec -it ticketing-backend node dist/scripts/resend-tickets.js --event-id <uuid> --email you@example.com --send
 *   docker exec -it ticketing-backend node dist/scripts/resend-tickets.js --event-id <uuid> --send
 *
 * Local:
 *
 *   DOTENV_PATH=.env.production npx ts-node -r tsconfig-paths/register src/scripts/resend-tickets.ts --list-events
 */
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource, In } from 'typeorm';
import * as QRCode from 'qrcode';
import { Event } from '../entities/event.entity';
import { Ticket, TicketStatus } from '../entities/ticket.entity';
import { User } from '../entities/user.entity';
import { EmailService } from '../modules/email/email.service';

const envPath = process.env.DOTENV_PATH || '.env';
if (fs.existsSync(envPath)) {
  config({ path: envPath });
}

const VALID_STATUSES = [TicketStatus.ISSUED, TicketStatus.WON];
const DATE_FMT: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Africa/Nairobi',
};

interface Args {
  send: boolean;
  listEvents: boolean;
  eventId?: string;
  email?: string;
  limit?: number;
  delayMs: number;
}

interface HolderBatch {
  email: string;
  name: string;
  tickets: Ticket[];
}

function parseArgs(argv: string[]): Args {
  const args: Args = { send: false, listEvents: false, delayMs: 400 };
  for (let i = 2; i < argv.length; i++) {
    const flag = argv[i];
    const next = argv[i + 1];
    if (flag === '--send') args.send = true;
    else if (flag === '--dry-run') args.send = false;
    else if (flag === '--list-events') args.listEvents = true;
    else if (flag === '--event-id' && next) {
      args.eventId = next;
      i++;
    } else if (flag === '--email' && next) {
      args.email = next.trim().toLowerCase();
      i++;
    } else if (flag === '--limit' && next) {
      args.limit = parseInt(next, 10);
      i++;
    } else if (flag === '--delay' && next) {
      args.delayMs = parseInt(next, 10);
      i++;
    } else if (flag === '--help' || flag === '-h') {
      printUsage();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${flag}`);
      printUsage();
      process.exit(1);
    }
  }
  return args;
}

function printUsage() {
  console.log(`
Resend ticket emails with QR codes.

Docker (production):
  docker exec -it ticketing-backend node dist/scripts/resend-tickets.js --list-events
  docker exec -it ticketing-backend node dist/scripts/resend-tickets.js --event-id <uuid>
  docker exec -it ticketing-backend node dist/scripts/resend-tickets.js --event-id <uuid> --email you@example.com --send
  docker exec -it ticketing-backend node dist/scripts/resend-tickets.js --event-id <uuid> --send

Options:
  --list-events          Show events and ticket counts
  --event-id <uuid>      Event to send for (required unless only one upcoming)
  --email <address>      Only send to this holder (use this for a test)
  --limit <n>            Cap number of holders
  --delay <ms>           Pause between sends (default 400)
  --send                 Actually send (default is dry-run)
  --dry-run              Preview only (default)
  --help
`);
}

function createDataSource(): DataSource {
  const ssl =
    process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false;
  const entityExt = __filename.endsWith('.js') ? 'js' : 'ts';
  const entities = [path.join(__dirname, '..', 'entities', `*.entity.${entityExt}`)];
  const common = { entities, synchronize: false as const, ssl };

  if (process.env.DATABASE_URL) {
    return new DataSource({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      ...common,
    });
  }

  return new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || process.env.DB_DATABASE || 'ticketing_db',
    ...common,
  });
}

function formatEventDate(date: Date): string {
  return new Date(date).toLocaleString('en-KE', DATE_FMT);
}

function displayName(user: User): string {
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return name || user.email.split('@')[0];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function qrPngBase64(ticket: Ticket): Promise<string> {
  const payload = JSON.stringify({
    ticketId: ticket.id,
    eventId: ticket.event_id,
    qrHash: ticket.qr_code_hash,
  });
  const buffer = await QRCode.toBuffer(payload, {
    type: 'png',
    width: 280,
    margin: 2,
    errorCorrectionLevel: 'M',
  });
  return buffer.toString('base64');
}

async function listEvents(ds: DataSource) {
  const rows: Array<{
    id: string;
    title: string;
    start_date: Date;
    status: string;
    ticket_count: string;
  }> = await ds.query(`
    SELECT e.id, e.title, e.start_date, e.status,
           COUNT(t.id) FILTER (
             WHERE t.status IN ('ISSUED', 'WON')
           )::int AS ticket_count
    FROM events e
    LEFT JOIN tickets t ON t.event_id = e.id
    GROUP BY e.id
    ORDER BY e.start_date DESC
    LIMIT 20
  `);

  console.log('\nEvents (most recent first):\n');
  for (const row of rows) {
    console.log(
      `  ${row.id}  ${formatEventDate(row.start_date)}  [${row.status}]  ${row.ticket_count} tickets  ${row.title}`,
    );
  }
  console.log('');
}

async function pickEvent(ds: DataSource, eventId?: string): Promise<Event> {
  const eventRepo = ds.getRepository(Event);
  if (eventId) {
    const event = await eventRepo.findOne({ where: { id: eventId } });
    if (!event) {
      throw new Error(`Event not found: ${eventId}`);
    }
    return event;
  }

  const upcoming = await eventRepo
    .createQueryBuilder('e')
    .where('e.start_date >= NOW() - INTERVAL \'12 hours\'')
    .andWhere("e.status IN ('PUBLISHED', 'COMPLETED')")
    .orderBy('e.start_date', 'ASC')
    .getMany();

  if (upcoming.length === 0) {
    throw new Error('No upcoming event found. Pass --event-id <uuid> (see --list-events).');
  }
  if (upcoming.length > 1) {
    console.log('Multiple upcoming events — pass --event-id:\n');
    for (const event of upcoming) {
      console.log(`  ${event.id}  ${formatEventDate(event.start_date)}  ${event.title}`);
    }
    throw new Error('Ambiguous event. Re-run with --event-id.');
  }
  return upcoming[0];
}

function groupByHolder(tickets: Ticket[]): HolderBatch[] {
  const map = new Map<string, HolderBatch>();
  for (const ticket of tickets) {
    const user = ticket.holder || ticket.purchaser;
    const email = user?.email?.trim().toLowerCase();
    if (!email) continue;
    const existing = map.get(email);
    if (existing) {
      existing.tickets.push(ticket);
    } else {
      map.set(email, {
        email,
        name: displayName(user),
        tickets: [ticket],
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.email.localeCompare(b.email));
}

async function sendWithRetry(
  emailService: EmailService,
  event: Event,
  holder: HolderBatch,
): Promise<boolean> {
  const tickets = [];
  for (const ticket of holder.tickets) {
    tickets.push({
      id: ticket.id,
      tierName: ticket.tier?.name || ticket.tier?.category || 'Ticket',
      qrPngBase64: await qrPngBase64(ticket),
    });
  }

  const payload = {
    customerName: holder.name,
    customerEmail: holder.email,
    eventTitle: event.title,
    eventDate: formatEventDate(event.start_date),
    eventLocation: event.venue || 'TBA',
    tickets,
  };

  let ok = await emailService.sendTicketsResend(payload);
  if (!ok) {
    await sleep(2000);
    ok = await emailService.sendTicketsResend(payload);
  }
  return ok;
}

async function main() {
  const args = parseArgs(process.argv);
  const ds = createDataSource();

  console.log(
    `DB: ${process.env.DB_HOST || process.env.DATABASE_URL || '(unset)'} / ${process.env.DB_NAME || process.env.DB_DATABASE || ''}`,
  );
  console.log(`BREVO_API_KEY: ${process.env.BREVO_API_KEY ? 'set' : 'MISSING'}`);

  await ds.initialize();

  try {
    if (args.listEvents) {
      await listEvents(ds);
      return;
    }

    const event = await pickEvent(ds, args.eventId);
    const ticketRepo = ds.getRepository(Ticket);
    const tickets = await ticketRepo.find({
      where: {
        event_id: event.id,
        status: In(VALID_STATUSES),
      },
      relations: ['tier', 'holder', 'purchaser'],
      order: { created_at: 'ASC' },
    });

    let holders = groupByHolder(tickets);
    const skippedNoEmail = tickets.length - holders.reduce((n, h) => n + h.tickets.length, 0);

    if (args.email) {
      holders = holders.filter((h) => h.email === args.email);
      if (holders.length === 0) {
        throw new Error(`No valid tickets found for ${args.email}`);
      }
    }
    if (args.limit && args.limit > 0) {
      holders = holders.slice(0, args.limit);
    }

    const ticketCount = holders.reduce((n, h) => n + h.tickets.length, 0);

    console.log('');
    console.log(`Event:    ${event.title}`);
    console.log(`When:     ${formatEventDate(event.start_date)}`);
    console.log(`Where:    ${event.venue}`);
    console.log(`Holders:  ${holders.length}`);
    console.log(`Tickets:  ${ticketCount}  (ISSUED/WON)`);
    if (skippedNoEmail > 0) {
      console.log(`Skipped:  ${skippedNoEmail} tickets with no holder/purchaser email`);
    }
    console.log(`Mode:     ${args.send ? 'SEND' : 'DRY RUN (no emails will be sent)'}`);
    console.log('');

    const preview = holders.slice(0, 15);
    for (const holder of preview) {
      const tiers = holder.tickets
        .map((t) => t.tier?.name || t.tier?.category || 'Ticket')
        .join(', ');
      console.log(`  ${holder.email.padEnd(36)}  ${String(holder.tickets.length).padStart(2)}  ${tiers}`);
    }
    if (holders.length > preview.length) {
      console.log(`  ... and ${holders.length - preview.length} more holders`);
    }
    console.log('');

    if (!args.send) {
      console.log('Dry run complete. Re-run with --send to deliver mail.');
      console.log('Recommended: --email you@example.com --send   first, then full --send.');
      return;
    }

    if (!process.env.BREVO_API_KEY) {
      throw new Error('BREVO_API_KEY is not set');
    }

    if (holders.length > 5 && !args.email) {
      console.log(`Sending to ${holders.length} holders in 5 seconds. Ctrl+C to abort.`);
      await sleep(5000);
    }

    const emailService = new EmailService();
    const started = new Date();
    const logLines = ['email,tickets,status,error'];
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < holders.length; i++) {
      const holder = holders[i];
      const label = `[${i + 1}/${holders.length}] ${holder.email} (${holder.tickets.length} ticket(s))`;
      try {
        const ok = await sendWithRetry(emailService, event, holder);
        if (ok) {
          sent++;
          logLines.push(`${holder.email},${holder.tickets.length},sent,`);
          console.log(`  sent  ${label}`);
        } else {
          failed++;
          logLines.push(`${holder.email},${holder.tickets.length},failed,send returned false`);
          console.error(`  FAIL  ${label}`);
        }
      } catch (error) {
        failed++;
        const message = error instanceof Error ? error.message : String(error);
        logLines.push(`${holder.email},${holder.tickets.length},failed,"${message.replace(/"/g, "'")}"`);
        console.error(`  FAIL  ${label}: ${message}`);
      }

      if (i < holders.length - 1) {
        await sleep(args.delayMs);
      }
    }

    const logPath = path.join(
      __dirname,
      `resend-tickets-${started.toISOString().replace(/[:.]/g, '-')}.csv`,
    );
    fs.writeFileSync(logPath, logLines.join('\n'));

    console.log('');
    console.log(`Done. Sent: ${sent}  Failed: ${failed}  Log: ${logPath}`);
    if (failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    await ds.destroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
