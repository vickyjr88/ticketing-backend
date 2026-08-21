# Ticketing System Backend

Event ticketing and management system backend built with NestJS, TypeORM, and PostgreSQL.

## Features

- 🎫 **Event Management** - Create and manage events with multiple ticket tiers
- 🎟️ **Ticket Sales** - Purchase tickets with multiple payment providers
- 🎰 **Lottery System** - "Adopt-a-Ticket" lottery for free ticket giveaways
- 💳 **Payment Integration** - Stripe, Paystack, and M-Pesa support
- 📱 **QR Code Generation** - Secure ticket QR codes for scanning
- 🔐 **Authentication** - JWT-based authentication with role-based access
- 📊 **Analytics Dashboard** - Advanced insights into sales, check-ins, and customer retention
- 📧 **Email Notifications** - Beautiful branded emails via Brevo for all activities
- 🏷️ **Promo Codes** - Discount codes with usage limits and expiry dates
- 📋 **Waitlist** - Notify users when sold-out tickets become available
- 🖼️ **S3 Image Upload** - Event banner images stored in AWS S3

## Tech Stack

- **Framework**: NestJS
- **Database**: PostgreSQL with TypeORM
- **Authentication**: JWT with Passport
- **Payments**: Stripe, Paystack, M-Pesa
- **Storage**: AWS S3
- **Validation**: class-validator
- **Documentation**: Swagger/OpenAPI

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 15+
- AWS Account (for S3)
- Payment provider accounts (Stripe, Paystack, M-Pesa)

## Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration
```

## Environment Variables

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_DATABASE=ticketing_db

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRATION=7d

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Paystack
PAYSTACK_SECRET_KEY=sk_test_...

# M-Pesa (Optional)
MPESA_CONSUMER_KEY=...
MPESA_CONSUMER_SECRET=...
MPESA_PASSKEY=...
MPESA_SHORTCODE=...
MPESA_CALLBACK_URL=...
MPESA_ENVIRONMENT=sandbox

# AWS S3
AWS_S3_BUCKET=your-bucket-name
AWS_S3_REGION=us-east-1
CDN_URL=https://your-cdn-url.com

# Email (Brevo)
BREVO_API_KEY=xkeysib-your-api-key
```

## Database Setup

```bash
# Run migrations
npm run migration:run

# Seed initial data (optional)
npm run seed
```

## Development

```bash
# Start development server
npm run start:dev

# Run in watch mode
npm run start:dev

# Build for production
npm run build

# Start production server
npm run start:prod
```

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## API Documentation

Once the server is running, visit:
- Swagger UI: http://localhost:3000/api
- API JSON: http://localhost:3000/api-json

## Project Structure

```
src/
├── config/           # Configuration files
├── entities/         # TypeORM entities
├── modules/          # Feature modules
│   ├── auth/        # Authentication
│   ├── events/      # Event management
│   ├── lottery/     # Lottery system
│   ├── orders/      # Order management
│   ├── payments/    # Payment processing
│   ├── tickets/     # Ticket management
│   └── users/       # User management
├── services/         # Shared services
│   └── s3.service.ts # S3 upload service
└── main.ts          # Application entry point
```

## Deployment

### Docker

```bash
# Build image
docker build -t ticketing-backend .

# Run container
docker run -p 3000:3000 --env-file .env ticketing-backend
```

### Docker Compose

```bash
# Start all services
docker-compose -f deployment/docker-compose.prod.yml up -d
```

## Resend ticket emails (Docker / production)

The backend image is compiled JS only (`dist/`). After deploying a build that includes this script, run it **inside** `ticketing-backend`. The container already has `DB_*` and `BREVO_API_KEY` from Compose — do not pass a `.env` file.

Rebuild first so `dist/scripts/resend-tickets.js` exists in the image:

```bash
docker compose build backend && docker compose up -d backend
# or however you normally redeploy ticketing-backend
docker logs --tail 50 ticketing-backend
```

Then SSH to the server and:

```bash
# 1. Confirm the script is in the image
docker exec ticketing-backend ls dist/scripts/resend-tickets.js

# 2. List events and ISSUED/WON ticket counts
docker exec -it ticketing-backend node dist/scripts/resend-tickets.js --list-events

# 3. Dry run (default) — prints holders, sends nothing
docker exec -it ticketing-backend node dist/scripts/resend-tickets.js --event-id <EVENT_UUID>

# 4. Test send to yourself
docker exec -it ticketing-backend node dist/scripts/resend-tickets.js --event-id <EVENT_UUID> --email you@example.com --send

# 5. Send everyone (5s delay, then one email per holder)
docker exec -it ticketing-backend node dist/scripts/resend-tickets.js --event-id <EVENT_UUID> --send
```

Copy the CSV log off the container when finished:

```bash
docker cp ticketing-backend:/app/dist/scripts/. ./resend-logs/
```

Watch mail errors on the backend:

```bash
docker logs -f ticketing-backend
```

Local (not Docker): `npm run tickets:resend:dev -- --list-events`

### AWS Deployment

See `../infrastructure/terraform/` for infrastructure as code setup.

## API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `GET /auth/profile` - Get user profile

### Events
- `GET /events` - List all events
- `GET /events/:id` - Get event details
- `POST /events` - Create event (authenticated)
- `PUT /events/:id` - Update event (authenticated)
- `DELETE /events/:id` - Delete event (authenticated)
- `POST /events/:id/upload-image` - Upload event banner

### Tickets
- `GET /events/:id/tiers` - Get ticket tiers
- `POST /events/:id/tiers` - Create ticket tier
- `PUT /events/:id/tiers/:tierId` - Update tier
- `DELETE /events/:id/tiers/:tierId` - Delete tier

### Orders
- `POST /orders/checkout` - Create order
- `GET /orders` - Get user orders
- `GET /orders/:id` - Get order details

### Payments
- `POST /payments/stripe/checkout` - Stripe checkout
- `POST /payments/paystack/initialize` - Paystack payment
- `POST /payments/mpesa/stk-push` - M-Pesa STK push

### Lottery
- `POST /lottery/enter/:eventId` - Enter lottery
- `GET /lottery/check/:eventId` - Check eligibility
- `POST /lottery/draw/:eventId` - Draw winners (admin)

## Security

- JWT authentication for protected routes
- Role-based access control (ADMIN, USER)
- Input validation with class-validator
- SQL injection prevention with TypeORM
- CORS configuration
- Rate limiting (recommended for production)

## Performance

- Database connection pooling
- Query optimization with TypeORM
- Caching (recommended for production)
- CDN for static assets (S3 + CloudFront)

## Monitoring

- Health check endpoint: `GET /health`
- Logging with NestJS Logger
- Error tracking (recommended: Sentry)
- Performance monitoring (recommended: New Relic)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is proprietary software.

## Support

For issues and questions:
- GitHub Issues: https://github.com/vickyjr88/ticketing-backend/issues
- Email: support@example.com

## Related Projects

- Frontend: `../web_ticketing/`
- Mobile App: `../mobile_app/`
- Infrastructure: `../infrastructure/`
# SSL fix deployment
