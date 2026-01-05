import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPrivateEvents1736090000000 implements MigrationInterface {
    name = 'AddPrivateEvents1736090000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create visibility enum
        await queryRunner.query(`
            CREATE TYPE "public"."events_visibility_enum" AS ENUM('PUBLIC', 'PRIVATE')
        `);

        // Add visibility column
        await queryRunner.query(`
            ALTER TABLE "events" 
            ADD COLUMN "visibility" "public"."events_visibility_enum" NOT NULL DEFAULT 'PUBLIC'
        `);

        // Add access_code column
        await queryRunner.query(`
            ALTER TABLE "events" 
            ADD COLUMN "access_code" character varying
        `);

        // Create index for visibility
        await queryRunner.query(`
            CREATE INDEX "IDX_events_visibility" ON "events" ("visibility")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_events_visibility"`);
        await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "access_code"`);
        await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "visibility"`);
        await queryRunner.query(`DROP TYPE "public"."events_visibility_enum"`);
    }
}
