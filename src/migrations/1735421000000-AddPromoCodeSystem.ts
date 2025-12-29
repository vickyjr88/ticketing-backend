import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPromoCodeSystem1735421000000 implements MigrationInterface {
    name = 'AddPromoCodeSystem1735421000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create enum for discount type
        await queryRunner.query(`
            CREATE TYPE "public"."promo_codes_discount_type_enum" AS ENUM('PERCENTAGE', 'FIXED_AMOUNT')
        `);

        // Create promo_codes table
        await queryRunner.query(`
            CREATE TABLE "promo_codes" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "code" character varying NOT NULL,
                "description" text,
                "discount_type" "public"."promo_codes_discount_type_enum" NOT NULL,
                "discount_value" numeric(10,2) NOT NULL,
                "event_id" uuid,
                "usage_limit" integer,
                "usage_count" integer NOT NULL DEFAULT 0,
                "per_user_limit" integer,
                "min_order_amount" numeric(10,2),
                "max_discount_amount" numeric(10,2),
                "valid_from" TIMESTAMP,
                "valid_until" TIMESTAMP,
                "is_active" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_promo_codes_code" UNIQUE ("code"),
                CONSTRAINT "PK_promo_codes_id" PRIMARY KEY ("id")
            )
        `);

        // Create promo_code_usages table
        await queryRunner.query(`
            CREATE TABLE "promo_code_usages" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "promo_code_id" uuid NOT NULL,
                "user_id" uuid NOT NULL,
                "order_id" uuid NOT NULL,
                "discount_applied" numeric(10,2) NOT NULL,
                "used_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_promo_code_usages_id" PRIMARY KEY ("id")
            )
        `);

        // Add promo code columns to orders table
        await queryRunner.query(`
            ALTER TABLE "orders" 
            ADD COLUMN "promo_code_id" uuid,
            ADD COLUMN "discount_amount" numeric(10,2),
            ADD COLUMN "subtotal" numeric(10,2)
        `);

        // Add foreign key constraints
        await queryRunner.query(`
            ALTER TABLE "promo_codes" 
            ADD CONSTRAINT "FK_promo_codes_event_id" 
            FOREIGN KEY ("event_id") REFERENCES "events"("id") 
            ON DELETE SET NULL ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "promo_code_usages" 
            ADD CONSTRAINT "FK_promo_code_usages_promo_code_id" 
            FOREIGN KEY ("promo_code_id") REFERENCES "promo_codes"("id") 
            ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "promo_code_usages" 
            ADD CONSTRAINT "FK_promo_code_usages_user_id" 
            FOREIGN KEY ("user_id") REFERENCES "users"("id") 
            ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "promo_code_usages" 
            ADD CONSTRAINT "FK_promo_code_usages_order_id" 
            FOREIGN KEY ("order_id") REFERENCES "orders"("id") 
            ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        // Create index on promo code for faster lookups
        await queryRunner.query(`
            CREATE INDEX "IDX_promo_codes_code" ON "promo_codes" ("code")
        `);

        // Create index for usage tracking
        await queryRunner.query(`
            CREATE INDEX "IDX_promo_code_usages_promo_code_id" 
            ON "promo_code_usages" ("promo_code_id")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_promo_code_usages_user_id" 
            ON "promo_code_usages" ("user_id")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes
        await queryRunner.query(`DROP INDEX "public"."IDX_promo_code_usages_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_promo_code_usages_promo_code_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_promo_codes_code"`);

        // Drop foreign key constraints
        await queryRunner.query(`ALTER TABLE "promo_code_usages" DROP CONSTRAINT "FK_promo_code_usages_order_id"`);
        await queryRunner.query(`ALTER TABLE "promo_code_usages" DROP CONSTRAINT "FK_promo_code_usages_user_id"`);
        await queryRunner.query(`ALTER TABLE "promo_code_usages" DROP CONSTRAINT "FK_promo_code_usages_promo_code_id"`);
        await queryRunner.query(`ALTER TABLE "promo_codes" DROP CONSTRAINT "FK_promo_codes_event_id"`);

        // Drop columns from orders table
        await queryRunner.query(`
            ALTER TABLE "orders" 
            DROP COLUMN "subtotal",
            DROP COLUMN "discount_amount",
            DROP COLUMN "promo_code_id"
        `);

        // Drop tables
        await queryRunner.query(`DROP TABLE "promo_code_usages"`);
        await queryRunner.query(`DROP TABLE "promo_codes"`);

        // Drop enum
        await queryRunner.query(`DROP TYPE "public"."promo_codes_discount_type_enum"`);
    }
}
