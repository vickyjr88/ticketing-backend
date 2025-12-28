import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixMissingColumns1735417000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Rename qr_code to qr_code_hash in tickets table
        const qrCodeExists = await queryRunner.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='tickets' AND column_name='qr_code'
        `);
        
        if (qrCodeExists.length > 0) {
            await queryRunner.query(`
                ALTER TABLE "tickets" RENAME COLUMN "qr_code" TO "qr_code_hash"
            `);
            
            // Add unique constraint and index
            await queryRunner.query(`
                ALTER TABLE "tickets" ADD CONSTRAINT "UQ_tickets_qr_code_hash" UNIQUE ("qr_code_hash")
            `);
            
            await queryRunner.query(`
                CREATE INDEX "IDX_tickets_qr_code_hash" ON "tickets" ("qr_code_hash")
            `);
        }

        // 2. Add checked_in_by to tickets table if it doesn't exist
        const checkedInByExists = await queryRunner.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='tickets' AND column_name='checked_in_by'
        `);
        
        if (checkedInByExists.length === 0) {
            await queryRunner.query(`
                ALTER TABLE "tickets" ADD COLUMN "checked_in_by" character varying
            `);
        }

        // 3. Remove event_id from orders table (not in entity)
        const orderEventIdExists = await queryRunner.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='orders' AND column_name='event_id'
        `);
        
        if (orderEventIdExists.length > 0) {
            // Drop foreign key constraint first
            await queryRunner.query(`
                ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "FK_orders_event_id"
            `);
            
            await queryRunner.query(`
                ALTER TABLE "orders" DROP COLUMN "event_id"
            `);
        }

        // 4. Rename payment_reference to provider_ref in orders table (if not already done)
        const paymentRefExists = await queryRunner.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='orders' AND column_name='payment_reference'
        `);
        
        const providerRefExists = await queryRunner.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='orders' AND column_name='provider_ref'
        `);
        
        if (paymentRefExists.length > 0 && providerRefExists.length === 0) {
            await queryRunner.query(`
                ALTER TABLE "orders" RENAME COLUMN "payment_reference" TO "provider_ref"
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Reverse the changes
        await queryRunner.query(`
            ALTER TABLE "tickets" DROP CONSTRAINT IF EXISTS "UQ_tickets_qr_code_hash"
        `);
        
        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_tickets_qr_code_hash"
        `);
        
        await queryRunner.query(`
            ALTER TABLE "tickets" RENAME COLUMN "qr_code_hash" TO "qr_code"
        `);
        
        await queryRunner.query(`
            ALTER TABLE "tickets" DROP COLUMN IF EXISTS "checked_in_by"
        `);
        
        await queryRunner.query(`
            ALTER TABLE "orders" ADD COLUMN "event_id" uuid
        `);
        
        await queryRunner.query(`
            ALTER TABLE "orders" RENAME COLUMN "provider_ref" TO "payment_reference"
        `);
    }
}
