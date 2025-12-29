import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductsAndOrderProducts1735500000000 implements MigrationInterface {
    name = 'AddProductsAndOrderProducts1735500000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create enum for product type
        await queryRunner.query(`
            CREATE TYPE "public"."products_type_enum" AS ENUM('MERCH', 'PARKING', 'BEVERAGE', 'SNACK', 'OTHER')
        `);

        // Create products table
        await queryRunner.query(`
            CREATE TABLE "products" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "event_id" uuid NOT NULL,
                "name" character varying NOT NULL,
                "description" text NOT NULL,
                "price" numeric(10,2) NOT NULL,
                "stock" integer NOT NULL DEFAULT 0,
                "image_url" character varying,
                "type" "public"."products_type_enum" NOT NULL DEFAULT 'OTHER',
                "active" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_products_id" PRIMARY KEY ("id")
            )
        `);

        // Create order_products table (junction table for orders and products)
        await queryRunner.query(`
            CREATE TABLE "order_products" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "order_id" uuid NOT NULL,
                "product_id" uuid NOT NULL,
                "quantity" integer NOT NULL,
                "unit_price" numeric(10,2) NOT NULL,
                CONSTRAINT "PK_order_products_id" PRIMARY KEY ("id")
            )
        `);

        // Add foreign key constraints for products table
        await queryRunner.query(`
            ALTER TABLE "products" 
            ADD CONSTRAINT "FK_products_event_id" 
            FOREIGN KEY ("event_id") REFERENCES "events"("id") 
            ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        // Add foreign key constraints for order_products table
        await queryRunner.query(`
            ALTER TABLE "order_products" 
            ADD CONSTRAINT "FK_order_products_order_id" 
            FOREIGN KEY ("order_id") REFERENCES "orders"("id") 
            ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "order_products" 
            ADD CONSTRAINT "FK_order_products_product_id" 
            FOREIGN KEY ("product_id") REFERENCES "products"("id") 
            ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        // Create indexes for better query performance
        await queryRunner.query(`
            CREATE INDEX "IDX_products_event_id" ON "products" ("event_id")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_products_active" ON "products" ("active")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_order_products_order_id" ON "order_products" ("order_id")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_order_products_product_id" ON "order_products" ("product_id")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes
        await queryRunner.query(`DROP INDEX "public"."IDX_order_products_product_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_order_products_order_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_products_active"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_products_event_id"`);

        // Drop foreign key constraints
        await queryRunner.query(`ALTER TABLE "order_products" DROP CONSTRAINT "FK_order_products_product_id"`);
        await queryRunner.query(`ALTER TABLE "order_products" DROP CONSTRAINT "FK_order_products_order_id"`);
        await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT "FK_products_event_id"`);

        // Drop tables
        await queryRunner.query(`DROP TABLE "order_products"`);
        await queryRunner.query(`DROP TABLE "products"`);

        // Drop enum
        await queryRunner.query(`DROP TYPE "public"."products_type_enum"`);
    }
}
