# Deployment Configuration

## GitHub Actions Deployment

This repository uses GitHub Actions for automated deployment to AWS EC2 via ECR (Elastic Container Registry).

### Required GitHub Secrets

Configure the following secrets in your GitHub repository (`Settings > Secrets and variables > Actions`):

#### AWS Configuration
- `AWS_ACCESS_KEY_ID` - AWS access key for ECR access
- `AWS_SECRET_ACCESS_KEY` - AWS secret key for ECR access
- `EC2_SSH_KEY` - Private SSH key for EC2 instance access

#### Database Configuration
- `DB_HOST` - PostgreSQL database host
- `DB_PORT` - PostgreSQL database port (default: 5432)
- `DB_USERNAME` - Database username
- `DB_PASSWORD` - Database password
- `DB_DATABASE` - Database name (e.g., ticketing_db)

#### Application Configuration
- `JWT_SECRET` - Secret key for JWT token generation (use a strong random string)
- `JWT_EXPIRATION` - JWT token expiration time (default: 7d)
- `FRONTEND_URL` - Frontend application URL for CORS configuration

#### Payment Gateway Configuration

##### M-Pesa (Kenyan mobile payments)
- `MPESA_CONSUMER_KEY` - M-Pesa API consumer key
- `MPESA_CONSUMER_SECRET` - M-Pesa API consumer secret
- `MPESA_PASSKEY` - M-Pesa STK push passkey
- `MPESA_SHORTCODE` - M-Pesa business shortcode
- `MPESA_CALLBACK_URL` - M-Pesa callback URL
- `MPESA_ENVIRONMENT` - M-Pesa environment (sandbox/production)

##### Stripe
- `STRIPE_SECRET_KEY` - Stripe secret API key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret

##### Paystack
- `PAYSTACK_SECRET_KEY` - Paystack secret API key

#### AWS S3 Configuration (for file uploads)
- `AWS_ACCESS_KEY_ID_S3` - AWS access key for S3 bucket access
- `AWS_SECRET_ACCESS_KEY_S3` - AWS secret key for S3 bucket access
- `AWS_REGION_S3` - AWS region for S3 bucket (e.g., us-east-1)
- `AWS_S3_BUCKET` - S3 bucket name for file storage

### Deployment Workflow

The deployment workflow (`deploy-ticketing-backend.yml`) is triggered on:
- Push to `main` or `master` branch
- Pull requests to `main` or `master` branch
- Changes to specific paths:
  - `src/**`
  - `Dockerfile`
  - `package*.json`
  - `tsconfig*.json`
  - `nest-cli.json`
  - `.github/workflows/deploy-ticketing-backend.yml`

### Deployment Process

1. **Build**: Docker image is built from the Dockerfile
2. **Push**: Image is pushed to Amazon ECR with both commit SHA and `latest` tags
3. **Deploy**: 
   - SSH into EC2 instance
   - Pull latest image from ECR
   - Stop and remove old container
   - Start new container with all environment variables
   - Verify deployment with health checks

### Accessing the Application

After deployment, the application will be available at:
- **API**: `http://3.225.246.72:4001/api`
- **Swagger Documentation**: `http://3.225.246.72:4001/api/docs`

### Manual Deployment

To manually trigger a deployment, push to the main branch or create a pull request.

### Troubleshooting

If deployment fails:

1. Check the GitHub Actions logs for detailed error messages
2. Verify all required secrets are configured correctly
3. SSH into the EC2 instance and check Docker logs:
   ```bash
   ssh ubuntu@3.225.246.72
   docker logs ticketing-backend
   ```
4. Verify the Docker container is running:
   ```bash
   docker ps --filter "name=ticketing-backend"
   ```
5. Check if the network exists:
   ```bash
   docker network ls
   docker network inspect vdm-network
   ```

### EC2 Prerequisites

Ensure your EC2 instance has:
- Docker installed
- AWS CLI configured
- Docker network `vdm-network` created:
  ```bash
  docker network create vdm-network
  ```
- Proper security group rules allowing:
  - Port 4001 (API)
  - Port 22 (SSH)
  - Outbound internet access for pulling images

### Environment Configuration

The application uses the following environment variables in production:

```bash
NODE_ENV=production
PORT=3000
DB_HOST=<database-host>
DB_PORT=5432
DB_USERNAME=<db-username>
DB_PASSWORD=<db-password>
DB_DATABASE=ticketing_db
JWT_SECRET=<jwt-secret>
JWT_EXPIRATION=7d
FRONTEND_URL=<frontend-url>

# Payment gateways (optional)
MPESA_CONSUMER_KEY=<mpesa-consumer-key>
MPESA_CONSUMER_SECRET=<mpesa-consumer-secret>
# ... other payment configs

# S3 for file storage
AWS_ACCESS_KEY_ID=<s3-access-key>
AWS_SECRET_ACCESS_KEY=<s3-secret-key>
AWS_REGION=<s3-region>
AWS_S3_BUCKET=<bucket-name>
```

### Local Docker Testing

To test the Docker image locally before deployment:

```bash
# Build the image
docker build -t ticketing-backend:local .

# Run the container
docker run -p 4001:3000 \
  -e NODE_ENV=production \
  -e DB_HOST=your-db-host \
  -e DB_USERNAME=your-db-user \
  -e DB_PASSWORD=your-db-password \
  -e DB_DATABASE=ticketing_db \
  -e JWT_SECRET=your-jwt-secret \
  ticketing-backend:local

# Test the API
curl http://localhost:4001/api
```

### Docker Compose Production

Alternatively, use the provided docker-compose for production:

```bash
# Make sure your .env file is properly configured
docker-compose -f deployment/docker-compose.prod.yml up -d
```
