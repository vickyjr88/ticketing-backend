import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFcmTokenToUsers1735607000000 implements MigrationInterface {
    name = 'AddFcmTokenToUsers1735607000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add fcm_token column to users table for push notifications
        await queryRunner.query(`
            ALTER TABLE "users" 
            ADD COLUMN "fcm_token" character varying
        `);

        // Create index for faster lookups when sending push notifications
        await queryRunner.query(`
            CREATE INDEX "IDX_users_fcm_token" ON "users" ("fcm_token")
            WHERE "fcm_token" IS NOT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop index
        await queryRunner.query(`DROP INDEX "IDX_users_fcm_token"`);

        // Drop column
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "fcm_token"`);
    }
}
