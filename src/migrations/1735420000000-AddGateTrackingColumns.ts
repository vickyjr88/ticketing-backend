import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGateTrackingColumns1735420000000 implements MigrationInterface {
    name = 'AddGateTrackingColumns1735420000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add assigned_gate column to users table (for scanners)
        await queryRunner.query(`
            ALTER TABLE "users" 
            ADD COLUMN "assigned_gate" character varying
        `);

        // Add checked_in_gate column to tickets table (for tracking which gate processed check-in)
        await queryRunner.query(`
            ALTER TABLE "tickets" 
            ADD COLUMN "checked_in_gate" character varying
        `);

        // Set default value for existing checked-in tickets to 'Unknown' to maintain data integrity
        await queryRunner.query(`
            UPDATE "tickets" 
            SET "checked_in_gate" = 'Unknown' 
            WHERE "status" = 'REDEEMED' 
            AND "checked_in_gate" IS NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop checked_in_gate column from tickets table
        await queryRunner.query(`
            ALTER TABLE "tickets" 
            DROP COLUMN "checked_in_gate"
        `);

        // Drop assigned_gate column from users table
        await queryRunner.query(`
            ALTER TABLE "users" 
            DROP COLUMN "assigned_gate"
        `);
    }
}
