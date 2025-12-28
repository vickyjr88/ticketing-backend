import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProviderRefToOrders1703800001000 implements MigrationInterface {
    name = 'AddProviderRefToOrders1703800001000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" ADD "provider_ref" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "provider_ref"`);
    }
}
