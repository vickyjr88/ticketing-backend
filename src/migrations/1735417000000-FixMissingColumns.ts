import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixMissingColumns1735417000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. qr_code_hash in tickets table
        const qrCodeHashExists = await queryRunner.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='tickets' AND column_name='qr_code_hash'
        `);

        if (qrCodeHashExists.length === 0) {
            // Check if qr_code exists to rename
            const qrCodeExists = await queryRunner.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='tickets' AND column_name='qr_code'
            `);

            if (qrCodeExists.length > 0) {
                // Rename
                await queryRunner.query(`
                    ALTER TABLE "tickets" RENAME COLUMN "qr_code" TO "qr_code_hash"
                `);
            } else {
                // Add new column
                await queryRunner.query(`
                    ALTER TABLE "tickets" ADD COLUMN "qr_code_hash" character varying
                `);
            }

            // Ensure constraints (if not already there - postgres usually handles index separately, but unique constraint needs name)
            // Try/catch block for constraints in case they exist?
            // Safer to check constraint existence, but simpler to just try valid SQL.
            // If we just renamed or added, it likely has no constraint unless it was renamed.

            // Add unique constraint and index
            try {
                await queryRunner.query(`
                    ALTER TABLE "tickets" ADD CONSTRAINT "UQ_tickets_qr_code_hash" UNIQUE ("qr_code_hash")
                `);
            } catch (e: any) {
                // Ignore if exists
                console.log('Constraint UQ_tickets_qr_code_hash might already exist', e.message);
            }

            try {
                await queryRunner.query(`
                    CREATE INDEX "IDX_tickets_qr_code_hash" ON "tickets" ("qr_code_hash")
                `);
            } catch (e: any) {
                console.log('Index IDX_tickets_qr_code_hash might already exist', e.message);
            }
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

        // 3. (REMOVED) Do NOT remove event_id from orders table. It is required.

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
        // This down migration is tricky because we support both rename and add in UP.
        // Simplified down:

        // Rename back qr_code_hash -> qr_code
        // Only if we want to revert fully. Posing risk if data was added.

        /*
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
        */

        // Don't mess with down too much, just basic revert logic from before but safer
        // ...
        // For now, I will leave down empty or commented out to prevent accidental data loss during dev reverts.
    }
}
