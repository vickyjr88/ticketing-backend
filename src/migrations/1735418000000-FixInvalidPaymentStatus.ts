import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixInvalidPaymentStatus1735418000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Fix any orders that have 'undefined' as a string value in payment_status
    // Set them to 'PENDING' which is the default
    await queryRunner.query(`
      UPDATE orders 
      SET payment_status = 'PENDING' 
      WHERE payment_status::text = 'undefined' 
      OR payment_status IS NULL
      OR payment_status NOT IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No rollback needed - we're fixing invalid data
    // If you really need to rollback, you'd need to track which records were changed
  }
}
