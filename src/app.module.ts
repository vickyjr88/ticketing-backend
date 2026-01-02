import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { typeOrmConfig } from './config/typeorm.config';

// Modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { EventsModule } from './modules/events/events.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { LotteryModule } from './modules/lottery/lottery.module';
import { AdminModule } from './modules/admin/admin.module';
import { WaitlistModule } from './modules/waitlist/waitlist.module';
import { PromoModule } from './modules/promo/promo.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { EmailModule } from './modules/email/email.module';
import { ProductsModule } from './modules/products/products.module';
import { MediaModule } from './modules/media/media.module';
import { CronService } from './modules/cron/cron/cron.service';

// Entities for CronService
import { Order } from './entities/order.entity';
import { Ticket } from './entities/ticket.entity';
import { TicketTier } from './entities/ticket-tier.entity';

@Module({
    imports: [
        // Configuration
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
        }),

        // Database
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                type: 'postgres',
                host: configService.get('DB_HOST') || 'localhost',
                port: parseInt(configService.get('DB_PORT')) || 5432,
                username: configService.get('DB_USERNAME') || 'postgres',
                password: configService.get('DB_PASSWORD') || 'postgres',
                database: configService.get('DB_NAME') || configService.get('DB_DATABASE') || 'ticketing_db',
                entities: [__dirname + '/**/*.entity{.ts,.js}'],
                synchronize: false, // Use migrations instead
                logging: configService.get('NODE_ENV') === 'development',
                ssl: configService.get('NODE_ENV') === 'production'
                    ? { rejectUnauthorized: false }
                    : false,
            }),
            inject: [ConfigService],
        }),

        // Scheduler for lottery draws
        ScheduleModule.forRoot(),

        // TypeORM entities for CronService
        TypeOrmModule.forFeature([Order, Ticket, TicketTier]),

        // Feature modules
        AuthModule,
        UsersModule,
        EventsModule,
        TicketsModule,
        OrdersModule,
        PaymentsModule,
        LotteryModule,
        AdminModule,
        WaitlistModule,
        PromoModule,
        AnalyticsModule,
        EmailModule,
        ProductsModule,
        MediaModule,
    ],
    providers: [CronService],
})
export class AppModule { }
