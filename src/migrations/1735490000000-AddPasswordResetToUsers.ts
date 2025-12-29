import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordResetToUsers1735490000000 implements MigrationInterface {
    name = 'AddPasswordResetToUsers1735490000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add reset_password_token column
        await queryRunner.query(`
            ALTER TABLE "users" 
            ADD COLUMN "reset_password_token" character varying
        `);

        // Add reset_password_expires column
        await queryRunner.query(`
            ALTER TABLE "users" 
            ADD COLUMN "reset_password_expires" TIMESTAMP
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop reset_password_expires column
        await queryRunner.query(`
            ALTER TABLE "users" 
            DROP COLUMN "reset_password_expires"
        `);

        // Drop reset_password_token column
        await queryRunner.query(`
            ALTER TABLE "users" 
            DROP COLUMN "reset_password_token"
        `);
    }
}
