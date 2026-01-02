import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateGatesTables1735826400000 implements MigrationInterface {
    name = 'CreateGatesTables1735826400000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create gates table
        await queryRunner.query(`
            CREATE TABLE "gates" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying NOT NULL,
                "description" text,
                "is_active" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_gates" PRIMARY KEY ("id")
            )
        `);

        // Create gate_assignments table
        await queryRunner.query(`
            CREATE TABLE "gate_assignments" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "gate_id" uuid NOT NULL,
                "event_id" uuid NOT NULL,
                "scanner_id" uuid,
                "is_active" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_gate_assignments" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_gate_event" UNIQUE ("gate_id", "event_id")
            )
        `);

        // Add foreign key constraints
        await queryRunner.query(`
            ALTER TABLE "gate_assignments" 
            ADD CONSTRAINT "FK_gate_assignments_gate" 
            FOREIGN KEY ("gate_id") REFERENCES "gates"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "gate_assignments" 
            ADD CONSTRAINT "FK_gate_assignments_event" 
            FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "gate_assignments" 
            ADD CONSTRAINT "FK_gate_assignments_scanner" 
            FOREIGN KEY ("scanner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
        `);

        // Create indexes for better performance
        await queryRunner.query(`CREATE INDEX "IDX_gate_assignments_gate" ON "gate_assignments" ("gate_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_gate_assignments_event" ON "gate_assignments" ("event_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_gate_assignments_scanner" ON "gate_assignments" ("scanner_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_gate_assignments_scanner"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_gate_assignments_event"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_gate_assignments_gate"`);

        // Drop foreign key constraints
        await queryRunner.query(`ALTER TABLE "gate_assignments" DROP CONSTRAINT IF EXISTS "FK_gate_assignments_scanner"`);
        await queryRunner.query(`ALTER TABLE "gate_assignments" DROP CONSTRAINT IF EXISTS "FK_gate_assignments_event"`);
        await queryRunner.query(`ALTER TABLE "gate_assignments" DROP CONSTRAINT IF EXISTS "FK_gate_assignments_gate"`);

        // Drop tables
        await queryRunner.query(`DROP TABLE IF EXISTS "gate_assignments"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "gates"`);
    }
}
