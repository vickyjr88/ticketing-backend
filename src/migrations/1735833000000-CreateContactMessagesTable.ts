import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateContactMessagesTable1735833000000 implements MigrationInterface {
    name = 'CreateContactMessagesTable1735833000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create enums
        await queryRunner.query(`
      CREATE TYPE "contact_message_status_enum" AS ENUM ('NEW', 'READ', 'REPLIED', 'ARCHIVED')
    `);

        await queryRunner.query(`
      CREATE TYPE "contact_subject_enum" AS ENUM ('GENERAL', 'SUPPORT', 'TICKETING', 'EVENTS', 'PARTNERSHIP', 'REFUND', 'OTHER')
    `);

        // Create contact_messages table
        await queryRunner.createTable(
            new Table({
                name: 'contact_messages',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        generationStrategy: 'uuid',
                        default: 'uuid_generate_v4()',
                    },
                    {
                        name: 'name',
                        type: 'varchar',
                        length: '100',
                    },
                    {
                        name: 'email',
                        type: 'varchar',
                        length: '255',
                    },
                    {
                        name: 'phone',
                        type: 'varchar',
                        length: '20',
                        isNullable: true,
                    },
                    {
                        name: 'subject',
                        type: 'contact_subject_enum',
                        default: "'GENERAL'",
                    },
                    {
                        name: 'message',
                        type: 'text',
                    },
                    {
                        name: 'status',
                        type: 'contact_message_status_enum',
                        default: "'NEW'",
                    },
                    {
                        name: 'admin_notes',
                        type: 'text',
                        isNullable: true,
                    },
                    {
                        name: 'replied_by',
                        type: 'uuid',
                        isNullable: true,
                    },
                    {
                        name: 'replied_at',
                        type: 'timestamptz',
                        isNullable: true,
                    },
                    {
                        name: 'ip_address',
                        type: 'varchar',
                        length: '50',
                        isNullable: true,
                    },
                    {
                        name: 'user_agent',
                        type: 'text',
                        isNullable: true,
                    },
                    {
                        name: 'created_at',
                        type: 'timestamptz',
                        default: 'NOW()',
                    },
                    {
                        name: 'updated_at',
                        type: 'timestamptz',
                        default: 'NOW()',
                    },
                ],
                indices: [
                    {
                        name: 'IDX_contact_status',
                        columnNames: ['status'],
                    },
                    {
                        name: 'IDX_contact_subject',
                        columnNames: ['subject'],
                    },
                    {
                        name: 'IDX_contact_created_at',
                        columnNames: ['created_at'],
                    },
                    {
                        name: 'IDX_contact_email',
                        columnNames: ['email'],
                    },
                ],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('contact_messages');
        await queryRunner.query(`DROP TYPE "contact_message_status_enum"`);
        await queryRunner.query(`DROP TYPE "contact_subject_enum"`);
    }
}
