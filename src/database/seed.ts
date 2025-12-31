import { DataSource } from 'typeorm';
import { Event, EventStatus } from '../entities/event.entity';
import { TicketTier, TierCategory } from '../entities/ticket-tier.entity';
import { User, UserRole } from '../entities/user.entity';
import * as bcrypt from 'bcryptjs';

/**
 * Seeder for the Home Run with Pipita ticketing system
 * Creates sample events with various ticket tiers:
 * - Die Hard Early Bird
 * - Flash Sales
 * - VIP/VVIP Tables
 * - Regular tickets
 * - Student discounts
 * - Adopt-a-Ticket (lottery enabled)
 */
export async function seedDatabase(dataSource: DataSource): Promise<void> {
    console.log('🌱 Starting database seeding...');

    const userRepository = dataSource.getRepository(User);
    const eventRepository = dataSource.getRepository(Event);
    const tierRepository = dataSource.getRepository(TicketTier);

    // Check if already seeded (idempotent)
    const existingUsers = await userRepository.count();
    const existingEvents = await eventRepository.count();
    
    if (existingUsers > 0 && existingEvents > 0) {
        console.log('⚠️ Database already seeded. Skipping...');
        return;
    }

    // Create admin user (idempotent)
    let adminUser = await userRepository.findOne({ where: { email: 'admin@homerunwithpipita.com' } });
    if (!adminUser) {
        const hashedPassword = await bcrypt.hash('Admin123!', 10);
        adminUser = userRepository.create({
            email: 'admin@homerunwithpipita.com',
            password: hashedPassword,
            first_name: 'Admin',
            last_name: 'User',
            phone_number: '+254700000000',
            role: UserRole.ADMIN,
        });
        await userRepository.save(adminUser);
        console.log('✅ Created admin user');
    }

    // Create scanner user (idempotent)
    let scannerUser = await userRepository.findOne({ where: { email: 'scanner@homerunwithpipita.com' } });
    if (!scannerUser) {
        const hashedPassword = await bcrypt.hash('Admin123!', 10);
        scannerUser = userRepository.create({
            email: 'scanner@homerunwithpipita.com',
            password: hashedPassword,
            first_name: 'Scanner',
            last_name: 'Staff',
            phone_number: '+254711111111',
            role: UserRole.SCANNER,
        });
        await userRepository.save(scannerUser);
        console.log('✅ Created scanner user');
    }

    // ===========================================
    // EVENT 1: Home Run with Pipita - Main Event
    // ===========================================
    const mainEvent = eventRepository.create({
        title: 'Home Run with Pipita 2025',
        description: `The biggest event of the year! Join us for an unforgettable night of entertainment, music, and celebration. 
    
🎤 Live performances by top artists
🍽️ Premium catering and drinks
🎉 VIP experiences and exclusive meet & greets
🌟 Special guest appearances

Don't miss the event everyone will be talking about!`,
        venue: 'Carnivore Grounds, Nairobi',
        start_date: new Date('2025-03-15T18:00:00Z'),
        end_date: new Date('2025-03-16T04:00:00Z'),
        status: EventStatus.PUBLISHED,
        lottery_enabled: true,
        lottery_draw_date: new Date('2025-03-10T12:00:00Z'),
        banner_image_url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30',
        user_id: adminUser.id,
    });
    await eventRepository.save(mainEvent);
    console.log('✅ Created main event: Home Run with Pipita 2025');

    // Die Hard Early Bird (Limited time - ends soon!)
    const dieHardEarlyBird = tierRepository.create({
        event_id: mainEvent.id,
        name: 'Die Hard Early Bird',
        category: TierCategory.REGULAR,
        price: 1500,
        tickets_per_unit: 1,
        initial_quantity: 200,
        remaining_quantity: 150,
        max_qty_per_order: 4,
        sales_start: new Date('2025-01-01T00:00:00Z'),
        sales_end: new Date('2025-01-31T23:59:59Z'),
        is_active: true,
    });
    await tierRepository.save(dieHardEarlyBird);

    // Flash Sale (Current active sale!)
    const flashSale = tierRepository.create({
        event_id: mainEvent.id,
        name: 'Flash Sale - 50% Off!',
        category: TierCategory.REGULAR,
        price: 1000,
        tickets_per_unit: 1,
        initial_quantity: 100,
        remaining_quantity: 75,
        max_qty_per_order: 2,
        sales_start: new Date('2025-01-15T00:00:00Z'),
        sales_end: new Date('2025-02-28T23:59:59Z'),
        is_active: true,
    });
    await tierRepository.save(flashSale);

    // Regular Admission
    const regularMain = tierRepository.create({
        event_id: mainEvent.id,
        name: 'Regular Admission',
        category: TierCategory.REGULAR,
        price: 2000,
        tickets_per_unit: 1,
        initial_quantity: 500,
        remaining_quantity: 450,
        max_qty_per_order: 10,
        sales_start: new Date('2025-01-01T00:00:00Z'),
        sales_end: new Date('2025-03-15T17:00:00Z'),
        is_active: true,
    });
    await tierRepository.save(regularMain);

    // VIP Table (Group ticket)
    const vipTable = tierRepository.create({
        event_id: mainEvent.id,
        name: 'VIP Table (6 persons)',
        category: TierCategory.VIP,
        price: 15000,
        tickets_per_unit: 6,
        initial_quantity: 30,
        remaining_quantity: 25,
        max_qty_per_order: 3,
        sales_start: new Date('2025-01-01T00:00:00Z'),
        sales_end: new Date('2025-03-14T23:59:59Z'),
        is_active: true,
    });
    await tierRepository.save(vipTable);

    // Mukuu VVIP Table (Premium group ticket)
    const mukuuVvip = tierRepository.create({
        event_id: mainEvent.id,
        name: 'Mukuu VVIP Table (10 persons)',
        category: TierCategory.VVIP,
        price: 50000,
        tickets_per_unit: 10,
        initial_quantity: 15,
        remaining_quantity: 12,
        max_qty_per_order: 2,
        sales_start: new Date('2025-01-01T00:00:00Z'),
        sales_end: new Date('2025-03-14T23:59:59Z'),
        is_active: true,
    });
    await tierRepository.save(mukuuVvip);

    // Student Ticket
    const studentMain = tierRepository.create({
        event_id: mainEvent.id,
        name: 'Student Pass',
        category: TierCategory.STUDENT,
        price: 800,
        tickets_per_unit: 1,
        initial_quantity: 150,
        remaining_quantity: 120,
        max_qty_per_order: 1,
        sales_start: new Date('2025-01-01T00:00:00Z'),
        sales_end: new Date('2025-03-15T17:00:00Z'),
        is_active: true,
    });
    await tierRepository.save(studentMain);

    // Adopt-a-Ticket (For lottery)
    const adoptTicket = tierRepository.create({
        event_id: mainEvent.id,
        name: 'Adopt-a-Ticket (Gift a ticket)',
        category: TierCategory.REGULAR,
        price: 2500,
        tickets_per_unit: 1,
        initial_quantity: 100,
        remaining_quantity: 80,
        max_qty_per_order: 5,
        sales_start: new Date('2025-01-01T00:00:00Z'),
        sales_end: new Date('2025-03-05T23:59:59Z'),
        is_active: true,
    });
    await tierRepository.save(adoptTicket);

    console.log('✅ Created 7 ticket tiers for main event');

    // ===========================================
    // EVENT 2: Summer Jam Festival
    // ===========================================
    const summerJam = eventRepository.create({
        title: 'Summer Jam Festival 2025',
        description: `Get ready for the hottest summer event! 3 days of non-stop music, art, and fun.

🎵 Multiple stages with diverse genres
🎨 Art installations and live painting
🍔 Food trucks and craft beverages
⛺ Camping options available

A weekend you will never forget!`,
        venue: 'Uhuru Gardens, Nairobi',
        start_date: new Date('2025-06-20T10:00:00Z'),
        end_date: new Date('2025-06-22T22:00:00Z'),
        status: EventStatus.PUBLISHED,
        lottery_enabled: false,
        banner_image_url: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3',
        user_id: adminUser.id,
    });
    await eventRepository.save(summerJam);
    console.log('✅ Created event: Summer Jam Festival 2025');

    // Summer Jam - Weekend Pass
    await tierRepository.save(tierRepository.create({
        event_id: summerJam.id,
        name: '3-Day Weekend Pass',
        category: TierCategory.REGULAR,
        price: 5000,
        tickets_per_unit: 1,
        initial_quantity: 1000,
        remaining_quantity: 800,
        max_qty_per_order: 5,
        sales_start: new Date('2025-02-01T00:00:00Z'),
        sales_end: new Date('2025-06-20T09:00:00Z'),
        is_active: true,
    }));

    // Summer Jam - Single Day
    await tierRepository.save(tierRepository.create({
        event_id: summerJam.id,
        name: 'Single Day Pass',
        category: TierCategory.REGULAR,
        price: 2500,
        tickets_per_unit: 1,
        initial_quantity: 2000,
        remaining_quantity: 1800,
        max_qty_per_order: 8,
        sales_start: new Date('2025-02-01T00:00:00Z'),
        sales_end: new Date('2025-06-22T10:00:00Z'),
        is_active: true,
    }));

    // Summer Jam - VIP Lounge
    await tierRepository.save(tierRepository.create({
        event_id: summerJam.id,
        name: 'VIP Lounge Access',
        category: TierCategory.VIP,
        price: 12000,
        tickets_per_unit: 1,
        initial_quantity: 200,
        remaining_quantity: 180,
        max_qty_per_order: 4,
        sales_start: new Date('2025-02-01T00:00:00Z'),
        sales_end: new Date('2025-06-19T23:59:59Z'),
        is_active: true,
    }));

    console.log('✅ Created 3 ticket tiers for Summer Jam');

    // ===========================================
    // EVENT 3: Tech Conference (Sold Out Example)
    // ===========================================
    const techConf = eventRepository.create({
        title: 'Nairobi Tech Summit 2025',
        description: `The premier technology conference in East Africa.

💻 Keynotes from global tech leaders
🚀 Startup pitch competitions
🤝 Networking opportunities
📚 Hands-on workshops

Connect, learn, and innovate!`,
        venue: 'KICC, Nairobi',
        start_date: new Date('2025-04-10T08:00:00Z'),
        end_date: new Date('2025-04-11T18:00:00Z'),
        status: EventStatus.PUBLISHED,
        lottery_enabled: false,
        banner_image_url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87',
        user_id: adminUser.id,
    });
    await eventRepository.save(techConf);
    console.log('✅ Created event: Nairobi Tech Summit 2025');

    // Tech Summit - Early Bird (Sold out)
    await tierRepository.save(tierRepository.create({
        event_id: techConf.id,
        name: 'Early Bird Pass',
        category: TierCategory.REGULAR,
        price: 3000,
        tickets_per_unit: 1,
        initial_quantity: 100,
        remaining_quantity: 0, // SOLD OUT
        max_qty_per_order: 2,
        sales_start: new Date('2025-01-01T00:00:00Z'),
        sales_end: new Date('2025-02-28T23:59:59Z'),
        is_active: true,
    }));

    // Tech Summit - Regular
    await tierRepository.save(tierRepository.create({
        event_id: techConf.id,
        name: 'Conference Pass',
        category: TierCategory.REGULAR,
        price: 5000,
        tickets_per_unit: 1,
        initial_quantity: 300,
        remaining_quantity: 50,
        max_qty_per_order: 4,
        sales_start: new Date('2025-01-01T00:00:00Z'),
        sales_end: new Date('2025-04-10T07:00:00Z'),
        is_active: true,
    }));

    // Tech Summit - Premium
    await tierRepository.save(tierRepository.create({
        event_id: techConf.id,
        name: 'Premium Pass (Front Row + Lunch)',
        category: TierCategory.VIP,
        price: 10000,
        tickets_per_unit: 1,
        initial_quantity: 50,
        remaining_quantity: 15,
        max_qty_per_order: 2,
        sales_start: new Date('2025-01-01T00:00:00Z'),
        sales_end: new Date('2025-04-09T23:59:59Z'),
        is_active: true,
    }));

    console.log('✅ Created 3 ticket tiers for Tech Summit');

    // ===========================================
    // EVENT 4: Charity Gala (Lottery Focus)
    // ===========================================
    const charityGala = eventRepository.create({
        title: 'Hearts of Hope Charity Gala',
        description: `An evening of elegance for a cause.

🎭 Black-tie dinner event
🎤 Live entertainment
🎁 Silent auction
💝 100% proceeds to children's education

Every ticket transforms a life!`,
        venue: 'Villa Rosa Kempinski, Nairobi',
        start_date: new Date('2025-05-05T19:00:00Z'),
        end_date: new Date('2025-05-05T23:59:59Z'),
        status: EventStatus.PUBLISHED,
        lottery_enabled: true,
        lottery_draw_date: new Date('2025-04-28T12:00:00Z'),
        banner_image_url: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622',
        user_id: adminUser.id,
    });
    await eventRepository.save(charityGala);
    console.log('✅ Created event: Hearts of Hope Charity Gala');

    // Charity Gala - Individual Seat
    await tierRepository.save(tierRepository.create({
        event_id: charityGala.id,
        name: 'Individual Seat',
        category: TierCategory.REGULAR,
        price: 15000,
        tickets_per_unit: 1,
        initial_quantity: 100,
        remaining_quantity: 70,
        max_qty_per_order: 2,
        sales_start: new Date('2025-02-01T00:00:00Z'),
        sales_end: new Date('2025-05-04T23:59:59Z'),
        is_active: true,
    }));

    // Charity Gala - Patron Table
    await tierRepository.save(tierRepository.create({
        event_id: charityGala.id,
        name: 'Patron Table (8 guests)',
        category: TierCategory.VVIP,
        price: 100000,
        tickets_per_unit: 8,
        initial_quantity: 10,
        remaining_quantity: 6,
        max_qty_per_order: 1,
        sales_start: new Date('2025-02-01T00:00:00Z'),
        sales_end: new Date('2025-05-01T23:59:59Z'),
        is_active: true,
    }));

    // Charity Gala - Adopt-a-Seat (for lottery)
    await tierRepository.save(tierRepository.create({
        event_id: charityGala.id,
        name: 'Adopt-a-Seat (Gift a seat)',
        category: TierCategory.REGULAR,
        price: 20000,
        tickets_per_unit: 1,
        initial_quantity: 50,
        remaining_quantity: 40,
        max_qty_per_order: 5,
        sales_start: new Date('2025-02-01T00:00:00Z'),
        sales_end: new Date('2025-04-25T23:59:59Z'),
        is_active: true,
    }));

    console.log('✅ Created 3 ticket tiers for Charity Gala');

    // ===========================================
    // EVENT 5: Draft/Upcoming Event
    // ===========================================
    const upcomingEvent = eventRepository.create({
        title: 'New Year\'s Eve Spectacular 2026',
        description: `Ring in 2026 in style! Details coming soon...`,
        venue: 'TBA',
        start_date: new Date('2025-12-31T20:00:00Z'),
        end_date: new Date('2026-01-01T06:00:00Z'),
        status: EventStatus.DRAFT, // Not yet published
        lottery_enabled: false,
        banner_image_url: 'https://images.unsplash.com/photo-1467810563316-b5476525c0f9',
        user_id: adminUser.id,
    });
    await eventRepository.save(upcomingEvent);
    console.log('✅ Created draft event: New Year\'s Eve Spectacular 2026');

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('📊 Summary:');
    console.log('   - 2 Users (Admin + Scanner)');
    console.log('   - 5 Events (4 Published, 1 Draft)');
    console.log('   - 16 Ticket Tiers across all events');
    console.log('\n🔑 Login credentials:');
    console.log('   Admin: admin@homerunwithpipita.com / Admin123!');
    console.log('   Scanner: scanner@homerunwithpipita.com / Admin123!');
}

// Run seeder if executed directly
export async function runSeeder(): Promise<void> {
    const { DataSource } = await import('typeorm');

    const dataSource = new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_DATABASE || 'ticketing_db',
        entities: [__dirname + '/../entities/*.entity{.ts,.js}'],
        synchronize: false,
    });

    try {
        await dataSource.initialize();
        console.log('📦 Database connection established');
        await seedDatabase(dataSource);
        await dataSource.destroy();
        console.log('🔌 Database connection closed');
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
}
