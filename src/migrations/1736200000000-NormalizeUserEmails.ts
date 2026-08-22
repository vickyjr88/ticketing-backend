import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeUserEmails1736200000000 implements MigrationInterface {
    name = 'NormalizeUserEmails1736200000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$
            DECLARE
                rec RECORD;
                keep_id uuid;
                extra_id uuid;
                ids uuid[];
            BEGIN
                FOR rec IN
                    SELECT LOWER(email) AS email_key,
                           array_agg(id ORDER BY created_at ASC) AS ids
                    FROM users
                    GROUP BY LOWER(email)
                    HAVING COUNT(*) > 1
                LOOP
                    ids := rec.ids;
                    keep_id := ids[1];
                    FOREACH extra_id IN ARRAY ids[2:array_length(ids, 1)]
                    LOOP
                        UPDATE orders SET user_id = keep_id WHERE user_id = extra_id;
                        UPDATE tickets SET purchaser_id = keep_id WHERE purchaser_id = extra_id;
                        UPDATE tickets SET holder_id = keep_id WHERE holder_id = extra_id;
                        UPDATE tickets SET checked_in_by = keep_id::text WHERE checked_in_by = extra_id::text;
                        UPDATE events SET user_id = keep_id WHERE user_id = extra_id;
                        UPDATE waitlists SET user_id = keep_id WHERE user_id = extra_id;

                        DELETE FROM lottery_entries e
                        WHERE e.user_id = extra_id
                          AND EXISTS (
                              SELECT 1 FROM lottery_entries k
                              WHERE k.user_id = keep_id AND k.event_id = e.event_id
                          );
                        UPDATE lottery_entries SET user_id = keep_id WHERE user_id = extra_id;

                        UPDATE gate_assignments SET scanner_id = keep_id WHERE scanner_id = extra_id;

                        DELETE FROM promo_code_usages p
                        WHERE p.user_id = extra_id
                          AND EXISTS (
                              SELECT 1 FROM promo_code_usages k
                              WHERE k.user_id = keep_id AND k.promo_code_id = p.promo_code_id
                          );
                        UPDATE promo_code_usages SET user_id = keep_id WHERE user_id = extra_id;

                        DELETE FROM users WHERE id = extra_id;
                    END LOOP;
                END LOOP;
            END $$;
        `);

        await queryRunner.query(`
            UPDATE users SET email = LOWER(email) WHERE email <> LOWER(email)
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_email_lower" ON users (LOWER(email))
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_email_lower"`);
    }
}
