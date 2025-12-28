import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1703800000000 implements MigrationInterface {
    name = 'InitialSchema1703800000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create UUID extension
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

        // Create enums
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('USER', 'ADMIN', 'SCANNER')`);
        await queryRunner.query(`CREATE TYPE "public"."events_status_enum" AS ENUM('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED')`);
        await queryRunner.query(`CREATE TYPE "public"."ticket_tiers_category_enum" AS ENUM('REGULAR', 'VIP', 'VVIP', 'STUDENT')`);
        await queryRunner.query(`CREATE TYPE "public"."tickets_type_enum" AS ENUM('STANDARD', 'ADOPTED')`);
        await queryRunner.query(`CREATE TYPE "public"."tickets_status_enum" AS ENUM('ISSUED', 'POOL', 'WON', 'REDEEMED', 'CANCELLED')`);
        await queryRunner.query(`CREATE TYPE "public"."orders_payment_status_enum" AS ENUM('PENDING', 'PAID', 'FAILED', 'REFUNDED')`);
        await queryRunner.query(`CREATE TYPE "public"."orders_payment_provider_enum" AS ENUM('MPESA', 'STRIPE', 'PAYSTACK')`);

        // Create users table
        await queryRunner.query(`
            CREATE TABLE "users" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "email" character varying NOT NULL,
                "password" character varying NOT NULL,
                "first_name" character varying NOT NULL,
                "last_name" character varying NOT NULL,
                "phone_number" character varying,
                "role" "public"."users_role_enum" NOT NULL DEFAULT 'USER',
                "is_active" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_users_email" UNIQUE ("email"),
                CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
            )
        `);

        // Create events table
        await queryRunner.query(`
            CREATE TABLE "events" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "title" character varying NOT NULL,
                "description" text NOT NULL,
                "venue" character varying NOT NULL,
                "start_date" TIMESTAMP NOT NULL,
                "end_date" TIMESTAMP NOT NULL,
                "banner_image_url" character varying,
                "status" "public"."events_status_enum" NOT NULL DEFAULT 'DRAFT',
                "lottery_enabled" boolean NOT NULL DEFAULT false,
                "lottery_draw_date" TIMESTAMP,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "user_id" uuid,
                CONSTRAINT "PK_events_id" PRIMARY KEY ("id")
            )
        `);

        // Create ticket_tiers table
        await queryRunner.query(`
            CREATE TABLE "ticket_tiers" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "event_id" uuid NOT NULL,
                "name" character varying NOT NULL,
                "category" "public"."ticket_tiers_category_enum" NOT NULL DEFAULT 'REGULAR',
                "price" numeric(10,2) NOT NULL,
                "tickets_per_unit" integer NOT NULL DEFAULT '1',
                "initial_quantity" integer NOT NULL,
                "remaining_quantity" integer NOT NULL,
                "max_qty_per_order" integer NOT NULL DEFAULT '10',
                "sales_start" TIMESTAMP,
                "sales_end" TIMESTAMP,
                "is_active" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_ticket_tiers_id" PRIMARY KEY ("id")
            )
        `);

        // Create orders table
        await queryRunner.query(`
            CREATE TABLE "orders" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "user_id" uuid NOT NULL,
                "event_id" uuid NOT NULL,
                "total_amount" numeric(10,2) NOT NULL,
                "payment_status" "public"."orders_payment_status_enum" NOT NULL DEFAULT 'PENDING',
                "payment_provider" "public"."orders_payment_provider_enum",
                "payment_reference" character varying,
                "payment_metadata" jsonb,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_orders_id" PRIMARY KEY ("id")
            )
        `);

        // Create tickets table
        await queryRunner.query(`
            CREATE TABLE "tickets" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "event_id" uuid NOT NULL,
                "tier_id" uuid NOT NULL,
                "order_id" uuid,
                "purchaser_id" uuid NOT NULL,
                "holder_id" uuid,
                "type" "public"."tickets_type_enum" NOT NULL DEFAULT 'STANDARD',
                "status" "public"."tickets_status_enum" NOT NULL DEFAULT 'ISSUED',
                "qr_code" character varying,
                "checked_in_at" TIMESTAMP,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_tickets_id" PRIMARY KEY ("id")
            )
        `);

        // Create lottery_entries table
        await queryRunner.query(`
            CREATE TABLE "lottery_entries" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "event_id" uuid NOT NULL,
                "user_id" uuid NOT NULL,
                "is_winner" boolean NOT NULL DEFAULT false,
                "won_at" TIMESTAMP,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_lottery_entries_event_user" UNIQUE ("event_id", "user_id"),
                CONSTRAINT "PK_lottery_entries_id" PRIMARY KEY ("id")
            )
        `);

        // Add foreign key constraints
        await queryRunner.query(`ALTER TABLE "events" ADD CONSTRAINT "FK_events_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ticket_tiers" ADD CONSTRAINT "FK_ticket_tiers_event_id" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_orders_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_orders_event_id" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_tickets_event_id" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_tickets_tier_id" FOREIGN KEY ("tier_id") REFERENCES "ticket_tiers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_tickets_order_id" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_tickets_purchaser_id" FOREIGN KEY ("purchaser_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_tickets_holder_id" FOREIGN KEY ("holder_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lottery_entries" ADD CONSTRAINT "FK_lottery_entries_event_id" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lottery_entries" ADD CONSTRAINT "FK_lottery_entries_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop foreign key constraints
        await queryRunner.query(`ALTER TABLE "lottery_entries" DROP CONSTRAINT "FK_lottery_entries_user_id"`);
        await queryRunner.query(`ALTER TABLE "lottery_entries" DROP CONSTRAINT "FK_lottery_entries_event_id"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_tickets_holder_id"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_tickets_purchaser_id"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_tickets_order_id"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_tickets_tier_id"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_tickets_event_id"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_orders_event_id"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_orders_user_id"`);
        await queryRunner.query(`ALTER TABLE "ticket_tiers" DROP CONSTRAINT "FK_ticket_tiers_event_id"`);
        await queryRunner.query(`ALTER TABLE "events" DROP CONSTRAINT "FK_events_user_id"`);

        // Drop tables
        await queryRunner.query(`DROP TABLE "lottery_entries"`);
        await queryRunner.query(`DROP TABLE "tickets"`);
        await queryRunner.query(`DROP TABLE "orders"`);
        await queryRunner.query(`DROP TABLE "ticket_tiers"`);
        await queryRunner.query(`DROP TABLE "events"`);
        await queryRunner.query(`DROP TABLE "users"`);

        // Drop enums
        await queryRunner.query(`DROP TYPE "public"."orders_payment_provider_enum"`);
        await queryRunner.query(`DROP TYPE "public"."orders_payment_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."tickets_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."tickets_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."ticket_tiers_category_enum"`);
        await queryRunner.query(`DROP TYPE "public"."events_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    }
}
