import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWaitlistsTable1735419000000 implements MigrationInterface {
    name = 'AddWaitlistsTable1735419000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create waitlists table
        await queryRunner.query(`
            CREATE TABLE "waitlists" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "email" character varying NOT NULL,
                "phone_number" character varying,
                "event_id" uuid NOT NULL,
                "tier_id" uuid NOT NULL,
                "user_id" uuid,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "notified" boolean NOT NULL DEFAULT false,
                CONSTRAINT "PK_waitlists_id" PRIMARY KEY ("id")
            )
        `);

        // Create unique index to prevent duplicate signups for same tier
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_waitlists_email_tier_id" ON "waitlists" ("email", "tier_id")
        `);

        // Add foreign key constraints
        await queryRunner.query(`
            ALTER TABLE "waitlists" ADD CONSTRAINT "FK_waitlists_event_id" 
            FOREIGN KEY ("event_id") REFERENCES "events"("id") 
            ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "waitlists" ADD CONSTRAINT "FK_waitlists_tier_id" 
            FOREIGN KEY ("tier_id") REFERENCES "ticket_tiers"("id") 
            ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "waitlists" ADD CONSTRAINT "FK_waitlists_user_id" 
            FOREIGN KEY ("user_id") REFERENCES "users"("id") 
            ON DELETE SET NULL ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop foreign key constraints
        await queryRunner.query(`ALTER TABLE "waitlists" DROP CONSTRAINT "FK_waitlists_user_id"`);
        await queryRunner.query(`ALTER TABLE "waitlists" DROP CONSTRAINT "FK_waitlists_tier_id"`);
        await queryRunner.query(`ALTER TABLE "waitlists" DROP CONSTRAINT "FK_waitlists_event_id"`);

        // Drop unique index
        await queryRunner.query(`DROP INDEX "public"."IDX_waitlists_email_tier_id"`);

        // Drop table
        await queryRunner.query(`DROP TABLE "waitlists"`);
    }
}
