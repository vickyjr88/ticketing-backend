import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsFeaturedToEvents1735601000000 implements MigrationInterface {
    name = 'AddIsFeaturedToEvents1735601000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add is_featured column to events table with default value false
        await queryRunner.query(`
            ALTER TABLE "events" 
            ADD COLUMN "is_featured" boolean NOT NULL DEFAULT false
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove is_featured column from events table
        await queryRunner.query(`
            ALTER TABLE "events" 
            DROP COLUMN "is_featured"
        `);
    }
}
