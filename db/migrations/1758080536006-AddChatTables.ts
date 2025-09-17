import { MigrationInterface, QueryRunner } from "typeorm";

export class AddChatTables1758080536006 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create session_type enum
        await queryRunner.query(`CREATE TYPE "githubagent"."session_type_enum" AS ENUM('PR_SPECIFIC', 'REPOSITORY_WIDE')`);

        // Create message_type enum
        await queryRunner.query(`CREATE TYPE "githubagent"."message_type_enum" AS ENUM('text', 'code', 'json', 'markdown')`);

        // Create sender_type enum
        await queryRunner.query(`CREATE TYPE "githubagent"."sender_type_enum" AS ENUM('user', 'bot')`);

        // Create chat_sessions table
        await queryRunner.query(`
            CREATE TABLE "githubagent"."chat_sessions" (
                "session_id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "session_name" character varying(255) NOT NULL,
                "session_type" "githubagent"."session_type_enum" NOT NULL,
                "last_activity" TIMESTAMP NOT NULL DEFAULT now(),
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP,
                "user_id" uuid NOT NULL,
                "pr_metadata_id" uuid,
                "repository_id" uuid,
                CONSTRAINT "PK_chat_sessions" PRIMARY KEY ("session_id")
            )
        `);

        // Create chat_messages table
        await queryRunner.query(`
            CREATE TABLE "githubagent"."chat_messages" (
                "message_id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "sender_type" "githubagent"."sender_type_enum" NOT NULL,
                "message_type" "githubagent"."message_type_enum" NOT NULL,
                "message_content" text NOT NULL,
                "context_used" jsonb,
                "query_classification" character varying(50),
                "response_metadata" jsonb,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP,
                "session_id" uuid NOT NULL,
                CONSTRAINT "PK_chat_messages" PRIMARY KEY ("message_id")
            )
        `);

        // Create indexes for chat_sessions
        await queryRunner.query(`CREATE INDEX "IDX_chat_sessions_user_id" ON "githubagent"."chat_sessions" ("user_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_chat_sessions_pr_metadata_id" ON "githubagent"."chat_sessions" ("pr_metadata_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_chat_sessions_repository_id" ON "githubagent"."chat_sessions" ("repository_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_chat_sessions_session_type" ON "githubagent"."chat_sessions" ("session_type")`);
        await queryRunner.query(`CREATE INDEX "IDX_chat_sessions_last_activity" ON "githubagent"."chat_sessions" ("last_activity")`);

        // Create indexes for chat_messages
        await queryRunner.query(`CREATE INDEX "IDX_chat_messages_session_id" ON "githubagent"."chat_messages" ("session_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_chat_messages_sender_type" ON "githubagent"."chat_messages" ("sender_type")`);
        await queryRunner.query(`CREATE INDEX "IDX_chat_messages_created_at" ON "githubagent"."chat_messages" ("created_at")`);

        // Add foreign key constraints
        await queryRunner.query(`
            ALTER TABLE "githubagent"."chat_sessions"
            ADD CONSTRAINT "FK_chat_sessions_user_id"
            FOREIGN KEY ("user_id") REFERENCES "githubagent"."users"("user_id")
            ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "githubagent"."chat_sessions"
            ADD CONSTRAINT "FK_chat_sessions_pr_metadata_id"
            FOREIGN KEY ("pr_metadata_id") REFERENCES "githubagent"."pr_metadata"("pr_metadata_id")
            ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "githubagent"."chat_sessions"
            ADD CONSTRAINT "FK_chat_sessions_repository_id"
            FOREIGN KEY ("repository_id") REFERENCES "githubagent"."repositories"("repository_id")
            ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "githubagent"."chat_messages"
            ADD CONSTRAINT "FK_chat_messages_session_id"
            FOREIGN KEY ("session_id") REFERENCES "githubagent"."chat_sessions"("session_id")
            ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop foreign key constraints
        await queryRunner.query(`ALTER TABLE "githubagent"."chat_messages" DROP CONSTRAINT "FK_chat_messages_session_id"`);
        await queryRunner.query(`ALTER TABLE "githubagent"."chat_sessions" DROP CONSTRAINT "FK_chat_sessions_repository_id"`);
        await queryRunner.query(`ALTER TABLE "githubagent"."chat_sessions" DROP CONSTRAINT "FK_chat_sessions_pr_metadata_id"`);
        await queryRunner.query(`ALTER TABLE "githubagent"."chat_sessions" DROP CONSTRAINT "FK_chat_sessions_user_id"`);

        // Drop indexes
        await queryRunner.query(`DROP INDEX "githubagent"."IDX_chat_messages_created_at"`);
        await queryRunner.query(`DROP INDEX "githubagent"."IDX_chat_messages_sender_type"`);
        await queryRunner.query(`DROP INDEX "githubagent"."IDX_chat_messages_session_id"`);
        await queryRunner.query(`DROP INDEX "githubagent"."IDX_chat_sessions_last_activity"`);
        await queryRunner.query(`DROP INDEX "githubagent"."IDX_chat_sessions_session_type"`);
        await queryRunner.query(`DROP INDEX "githubagent"."IDX_chat_sessions_repository_id"`);
        await queryRunner.query(`DROP INDEX "githubagent"."IDX_chat_sessions_pr_metadata_id"`);
        await queryRunner.query(`DROP INDEX "githubagent"."IDX_chat_sessions_user_id"`);

        // Drop tables
        await queryRunner.query(`DROP TABLE "githubagent"."chat_messages"`);
        await queryRunner.query(`DROP TABLE "githubagent"."chat_sessions"`);

        // Drop enums
        await queryRunner.query(`DROP TYPE "githubagent"."sender_type_enum"`);
        await queryRunner.query(`DROP TYPE "githubagent"."message_type_enum"`);
        await queryRunner.query(`DROP TYPE "githubagent"."session_type_enum"`);
    }

}
