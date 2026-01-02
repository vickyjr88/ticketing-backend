import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentConfigsTable1735602000000 implements MigrationInterface {
    name = 'AddPaymentConfigsTable1735602000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create enum type for payment_provider (reuse from orders table)
        // Note: If the enum already exists from orders table, we don't need to recreate it
        // But we reference it in the new table
        
        // Create payment_configs table
        await queryRunner.query(`
            CREATE TABLE "payment_configs" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "provider" "orders_payment_provider_enum" NOT NULL,
                "is_enabled" boolean NOT NULL DEFAULT false,
                "credentials" jsonb,
                "is_test_mode" boolean NOT NULL DEFAULT false,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_payment_configs_provider" UNIQUE ("provider"),
                CONSTRAINT "PK_payment_configs" PRIMARY KEY ("id")
            )
        `);

        // Create index on provider for faster lookups
        await queryRunner.query(`
            CREATE INDEX "IDX_payment_configs_provider" ON "payment_configs" ("provider")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop index
        await queryRunner.query(`
            DROP INDEX "IDX_payment_configs_provider"
        `);

        // Drop table
        await queryRunner.query(`
            DROP TABLE "payment_configs"
        `);
    }
}
