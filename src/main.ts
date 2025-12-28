import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import { seedDatabase } from './database/seed';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Run migrations and seeds on startup
  try {
    const dataSource = app.get(DataSource);
    
    // Run migrations (if any exist)
    console.log('🔄 Running database migrations...');
    const migrations = await dataSource.runMigrations();
    if (migrations.length > 0) {
      console.log(`✅ Ran ${migrations.length} migrations`);
    } else {
      console.log('✅ No migrations to run');
    }

    // Run seeds
    console.log('🌱 Running database seeds...');
    await seedDatabase(dataSource);
    console.log('✅ Seeds completed');
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    // Don't exit - let the app start anyway
  }

  // Enable CORS for multiple origins
  const allowedOrigins = [
    'http://localhost:4002',  // Docker frontend
    'http://localhost:5173',  // Vite dev server
    'http://localhost:3000',  // Alternative port
    'http://127.0.0.1:4002',
    'http://127.0.0.1:5173',
    'http://3.225.246.72:3000',  // Production frontend
    process.env.FRONTEND_URL,
  ].filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // API prefix
  app.setGlobalPrefix('api');

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Home Run with Pipita - Ticketing API')
    .setDescription('Event ticketing platform with lottery system')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
}
bootstrap();
