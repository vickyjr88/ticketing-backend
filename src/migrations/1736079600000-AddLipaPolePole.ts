import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLipaPolePole1736079600000 implements MigrationInterface {
    name = 'AddLipaPolePole1736079600000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create payment_type enum
        await queryRunner.query(`
            CREATE TYPE "public"."orders_payment_type_enum" AS ENUM('FULL', 'LIPA_POLE_POLE')
        `);

        // Add PARTIAL to payment_status enum
        await queryRunner.query(`
            ALTER TYPE "public"."orders_payment_status_enum" ADD VALUE IF NOT EXISTS 'PARTIAL'
        `);

        // Add new columns to orders table
        await queryRunner.query(`
            ALTER TABLE "orders" 
            ADD COLUMN IF NOT EXISTS "payment_type" "public"."orders_payment_type_enum" NOT NULL DEFAULT 'FULL'
        `);

        await queryRunner.query(`
            ALTER TABLE "orders" 
            ADD COLUMN IF NOT EXISTS "amount_paid" decimal(10,2) NOT NULL DEFAULT 0
        `);

        await queryRunner.query(`
            ALTER TABLE "orders" 
            ADD COLUMN IF NOT EXISTS "layaway_deadline" TIMESTAMP
        `);

        // Create partial_payments table
        await queryRunner.query(`
            CREATE TYPE "public"."partial_payments_status_enum" AS ENUM('PENDING', 'COMPLETED', 'FAILED')
        `);

        await queryRunner.query(`
            CREATE TABLE "partial_payments" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "order_id" uuid NOT NULL,
                "amount" decimal(10,2) NOT NULL,
                "status" "public"."partial_payments_status_enum" NOT NULL DEFAULT 'PENDING',
                "payment_provider" character varying,
                "transaction_reference" character varying,
                "phone_number" character varying,
                "payment_metadata" jsonb,
                "completed_at" TIMESTAMP,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_partial_payments" PRIMARY KEY ("id")
            )
        `);

        // Add foreign key constraint
        await queryRunner.query(`
            ALTER TABLE "partial_payments" 
            ADD CONSTRAINT "FK_partial_payments_order" 
            FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        // Create indexes for performance
        await queryRunner.query(`
            CREATE INDEX "IDX_partial_payments_order_id" ON "partial_payments" ("order_id")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_partial_payments_status" ON "partial_payments" ("status")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_orders_payment_type" ON "orders" ("payment_type")
        `);

        // Update existing orders to have amount_paid = total_amount if already PAID
        await queryRunner.query(`
            UPDATE "orders" 
            SET "amount_paid" = "total_amount" 
            WHERE "payment_status" = 'PAID'
        `);

        // Add allows_layaway column to events table
        await queryRunner.query(`
            ALTER TABLE "events" 
            ADD COLUMN IF NOT EXISTS "allows_layaway" boolean NOT NULL DEFAULT false
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_payment_type"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_partial_payments_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_partial_payments_order_id"`);

        // Drop foreign key and table
        await queryRunner.query(`ALTER TABLE "partial_payments" DROP CONSTRAINT IF EXISTS "FK_partial_payments_order"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "partial_payments"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."partial_payments_status_enum"`);

        // Remove columns from orders
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "layaway_deadline"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "amount_paid"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "payment_type"`);

        // Drop payment type enum
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."orders_payment_type_enum"`);

        // Remove allows_layaway from events
        await queryRunner.query(`ALTER TABLE "events" DROP COLUMN IF EXISTS "allows_layaway"`);
    }
}
