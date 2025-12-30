import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMediaTable1735510000000 implements MigrationInterface {
    name = 'AddMediaTable1735510000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create media table
        await queryRunner.query(`
            CREATE TABLE "media" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "url" character varying NOT NULL,
                "key" character varying NOT NULL,
                "filename" character varying NOT NULL,
                "mimetype" character varying NOT NULL,
                "size" integer NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_media_id" PRIMARY KEY ("id")
            )
        `);

        // Create indexes for better query performance
        await queryRunner.query(`
            CREATE INDEX "IDX_media_created_at" ON "media" ("created_at")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_media_key" ON "media" ("key")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes
        await queryRunner.query(`DROP INDEX "public"."IDX_media_key"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_media_created_at"`);

        // Drop table
        await queryRunner.query(`DROP TABLE "media"`);
    }
}
