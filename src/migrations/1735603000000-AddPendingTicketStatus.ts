import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPendingTicketStatus1735603000000 implements MigrationInterface {
    name = 'AddPendingTicketStatus1735603000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add PENDING to the tickets_status_enum
        await queryRunner.query(`
            ALTER TYPE "tickets_status_enum" 
            ADD VALUE IF NOT EXISTS 'PENDING'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Note: PostgreSQL does not support removing enum values directly
        // This would require recreating the enum type and updating all references
        // For safety, we'll leave the enum value in place on rollback
        
        await queryRunner.query(`
            -- Warning: Cannot remove enum value in PostgreSQL
            -- Manual intervention required if strict rollback needed
            SELECT 1
        `);
    }
}
