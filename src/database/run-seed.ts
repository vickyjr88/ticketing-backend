import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';
import { seedDatabase } from './seed';

async function bootstrap() {
    console.log('🚀 Starting seeder...');

    const app = await NestFactory.createApplicationContext(AppModule);
    const dataSource = app.get(DataSource);

    try {
        await seedDatabase(dataSource);
        console.log('✅ Seeding completed!');
    } catch (error) {
        console.error('❌ Seeding failed:', error);
    } finally {
        await app.close();
    }
}

bootstrap();
