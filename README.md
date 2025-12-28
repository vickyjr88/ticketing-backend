# Ticketing System Backend

Event ticketing and management system backend built with NestJS, TypeORM, and PostgreSQL.

## Features

- 🎫 **Event Management** - Create and manage events with multiple ticket tiers
- 🎟️ **Ticket Sales** - Purchase tickets with multiple payment providers
- 🎰 **Lottery System** - "Adopt-a-Ticket" lottery for free ticket giveaways
- 💳 **Payment Integration** - Stripe, Paystack, and M-Pesa support
- 📱 **QR Code Generation** - Secure ticket QR codes for scanning
- 🔐 **Authentication** - JWT-based authentication with role-based access
- 📊 **Order Management** - Track orders and ticket sales
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
AWS_S3_BUCKET_NAME=your-bucket-name
AWS_S3_REGION=us-east-1
CDN_URL=https://your-cdn-url.com
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
