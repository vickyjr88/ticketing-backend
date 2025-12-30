import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductIdsToPromoCodes1735590000000 implements MigrationInterface {
    name = 'AddProductIdsToPromoCodes1735590000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "promo_codes" 
            ADD COLUMN "product_ids" text
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "promo_codes" 
            DROP COLUMN "product_ids"
        `);
    }
}
