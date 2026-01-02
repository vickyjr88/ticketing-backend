import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddComplimentaryPaymentProvider1735600000000 implements MigrationInterface {
    name = 'AddComplimentaryPaymentProvider1735600000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add COMPLIMENTARY to the payment_provider enum
        await queryRunner.query(`
            ALTER TYPE "orders_payment_provider_enum" 
            ADD VALUE IF NOT EXISTS 'COMPLIMENTARY'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Note: PostgreSQL does not support removing enum values directly
        // This would require recreating the enum type and updating all references
        // For safety, we'll leave the enum value in place on rollback
        // If strict rollback is needed, manual intervention would be required
        
        // Alternatively, we can set a constraint to prevent its usage
        await queryRunner.query(`
            -- Warning: Cannot remove enum value in PostgreSQL
            -- Manual intervention required if strict rollback needed
            SELECT 1
        `);
    }
}
