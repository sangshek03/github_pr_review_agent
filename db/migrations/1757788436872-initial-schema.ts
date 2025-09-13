import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1757788436872 implements MigrationInterface {
    name = 'InitialSchema1757788436872'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "githubagent"."auth_providers_provider_enum" AS ENUM('google', 'github')`);
        await queryRunner.query(`CREATE TABLE "githubagent"."auth_providers" ("auth_provider_id" uuid NOT NULL DEFAULT uuid_generate_v4(), "provider" "githubagent"."auth_providers_provider_enum" NOT NULL, "provider_account_id" character varying(255) NOT NULL, "access_token_encrypted" text, "refresh_token_encrypted" text, "scope" text, "expires_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "user_id" uuid, CONSTRAINT "PK_ef03bdd80497e3951e2e5faedb6" PRIMARY KEY ("auth_provider_id"))`);
        await queryRunner.query(`CREATE TABLE "githubagent"."users" ("user_id" uuid NOT NULL DEFAULT uuid_generate_v4(), "f_name" character varying(255), "l_name" character varying(255), "email" character varying(255) NOT NULL, "email_verified" boolean NOT NULL DEFAULT false, "avatar_url" text, "phone" character varying(255), "password" character varying(255), "refresh_token" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_96aac72f1574b88752e9fb00089" PRIMARY KEY ("user_id"))`);
        await queryRunner.query(`CREATE TYPE "githubagent"."user_sessions_status_enum" AS ENUM('active', 'expired', 'revoked')`);
        await queryRunner.query(`CREATE TABLE "githubagent"."user_sessions" ("user_session_id" uuid NOT NULL DEFAULT uuid_generate_v4(), "session_token" character varying(255) NOT NULL, "expires_at" TIMESTAMP NOT NULL, "status" "githubagent"."user_sessions_status_enum" NOT NULL DEFAULT 'active', "ip_address" character varying(45), "user_agent" text, "device_fingerprint" character varying(100), "location" character varying(100), "last_activity_at" TIMESTAMP, "session_data" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "user_id" uuid, CONSTRAINT "UQ_e5eb7a3c7766f941fe16b9edecb" UNIQUE ("session_token"), CONSTRAINT "PK_8f2ba43c7728251e8cc63bc1d1d" PRIMARY KEY ("user_session_id"))`);
        await queryRunner.query(`CREATE TABLE "githubagent"."repositories" ("repository_id" uuid NOT NULL DEFAULT uuid_generate_v4(), "repository_name" character varying(255) NOT NULL, "repository_owner" character varying(255) NOT NULL, "repository_url" character varying(500) NOT NULL, "languages" jsonb, "metadata" jsonb, "description" text NOT NULL, "stars" integer NOT NULL, "forks" integer NOT NULL, "watchers" integer NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "UQ_fb1084b08c39a6c6fb51b254718" UNIQUE ("repository_url"), CONSTRAINT "PK_9175aaa2fdb3a4272a2153ef335" PRIMARY KEY ("repository_id"))`);
        await queryRunner.query(`CREATE TYPE "githubagent"."chat_messages_sender_enum" AS ENUM('user', 'ai')`);
        await queryRunner.query(`CREATE TABLE "githubagent"."chat_messages" ("chat_id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sender" "githubagent"."chat_messages_sender_enum" NOT NULL, "content" jsonb NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "pr_review_id" uuid, CONSTRAINT "PK_9f5c0b96255734666b7b4bc98c3" PRIMARY KEY ("chat_id"))`);
        await queryRunner.query(`CREATE TYPE "githubagent"."pr_files_change_type_enum" AS ENUM('added', 'modified', 'deleted', 'renamed')`);
        await queryRunner.query(`CREATE TABLE "githubagent"."pr_files" ("pr_file_id" uuid NOT NULL DEFAULT uuid_generate_v4(), "file_path" character varying(500) NOT NULL, "previous_file_path" character varying(500), "change_type" "githubagent"."pr_files_change_type_enum" NOT NULL, "additions" integer NOT NULL DEFAULT '0', "deletions" integer NOT NULL DEFAULT '0', "patch" text, "file_language" character varying(100), "file_size_bytes" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "pr_review_id" uuid, CONSTRAINT "PK_452ef490c1edc37c65b230d8b1c" PRIMARY KEY ("pr_file_id"))`);
        await queryRunner.query(`CREATE TABLE "githubagent"."pr_commits" ("pr_commit_id" uuid NOT NULL DEFAULT uuid_generate_v4(), "commit_sha" character varying(40) NOT NULL, "message" text NOT NULL, "author" character varying(255) NOT NULL, "author_email" character varying(255) NOT NULL, "committed_at" TIMESTAMP NOT NULL, "parent_sha" character varying(40), "commit_url" character varying(500), "additions" integer NOT NULL DEFAULT '0', "deletions" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "pr_review_id" uuid, CONSTRAINT "UQ_1cec6297b98120a1e15e037ae74" UNIQUE ("commit_sha"), CONSTRAINT "PK_8ae5bdd65ac8f96bf1d1bbda31a" PRIMARY KEY ("pr_commit_id"))`);
        await queryRunner.query(`CREATE TYPE "githubagent"."pr_reviews_status_enum" AS ENUM('pending', 'completed', 'failed')`);
        await queryRunner.query(`CREATE TABLE "githubagent"."pr_reviews" ("pr_review_id" uuid NOT NULL DEFAULT uuid_generate_v4(), "pr_url" character varying NOT NULL, "pr_number" integer NOT NULL, "title" character varying(500) NOT NULL, "description" text NOT NULL, "author" character varying(255) NOT NULL, "status" "githubagent"."pr_reviews_status_enum" NOT NULL, "base_branch" character varying(255) NOT NULL, "head_branch" character varying(255) NOT NULL, "files_changed" integer NOT NULL, "additions" integer NOT NULL, "deletions" integer NOT NULL, "summary" text NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "user_id" uuid, "repository_id" uuid, CONSTRAINT "UQ_5417e0252e49d26709adb342a9d" UNIQUE ("pr_url"), CONSTRAINT "PK_0296f0e7acb79a4679e0f402e47" PRIMARY KEY ("pr_review_id"))`);
        await queryRunner.query(`CREATE TYPE "githubagent"."review_findings_category_enum" AS ENUM('positive', 'issue', 'suggestion', 'future_bug')`);
        await queryRunner.query(`CREATE TYPE "githubagent"."review_findings_severity_enum" AS ENUM('low', 'medium', 'high')`);
        await queryRunner.query(`CREATE TABLE "githubagent"."review_findings" ("review_finding_id" uuid NOT NULL DEFAULT uuid_generate_v4(), "category" "githubagent"."review_findings_category_enum" NOT NULL, "file_path" character varying(500), "line_number" integer, "severity" "githubagent"."review_findings_severity_enum", "description" text NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "pr_review_id" uuid, CONSTRAINT "PK_0eba2aa8d0c99533d48a960845b" PRIMARY KEY ("review_finding_id"))`);
        await queryRunner.query(`ALTER TABLE "githubagent"."auth_providers" ADD CONSTRAINT "FK_262996fd08ab5a69e85b53d0055" FOREIGN KEY ("user_id") REFERENCES "githubagent"."users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "githubagent"."user_sessions" ADD CONSTRAINT "FK_e9658e959c490b0a634dfc54783" FOREIGN KEY ("user_id") REFERENCES "githubagent"."users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "githubagent"."chat_messages" ADD CONSTRAINT "FK_dbda1a146c3d74433ed90923f66" FOREIGN KEY ("pr_review_id") REFERENCES "githubagent"."pr_reviews"("pr_review_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "githubagent"."pr_files" ADD CONSTRAINT "FK_78a829ba8f68507cbef73f0dcb2" FOREIGN KEY ("pr_review_id") REFERENCES "githubagent"."pr_reviews"("pr_review_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "githubagent"."pr_commits" ADD CONSTRAINT "FK_b2919fc7c2dc1d0e97118d04bbd" FOREIGN KEY ("pr_review_id") REFERENCES "githubagent"."pr_reviews"("pr_review_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "githubagent"."pr_reviews" ADD CONSTRAINT "FK_b6052a618c0088a44ebb1e872bb" FOREIGN KEY ("user_id") REFERENCES "githubagent"."users"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "githubagent"."pr_reviews" ADD CONSTRAINT "FK_fd0720a92c5b00f47fa21c7fa4e" FOREIGN KEY ("repository_id") REFERENCES "githubagent"."repositories"("repository_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "githubagent"."review_findings" ADD CONSTRAINT "FK_9c22b3559e772d415bcdecd5a63" FOREIGN KEY ("pr_review_id") REFERENCES "githubagent"."pr_reviews"("pr_review_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "githubagent"."review_findings" DROP CONSTRAINT "FK_9c22b3559e772d415bcdecd5a63"`);
        await queryRunner.query(`ALTER TABLE "githubagent"."pr_reviews" DROP CONSTRAINT "FK_fd0720a92c5b00f47fa21c7fa4e"`);
        await queryRunner.query(`ALTER TABLE "githubagent"."pr_reviews" DROP CONSTRAINT "FK_b6052a618c0088a44ebb1e872bb"`);
        await queryRunner.query(`ALTER TABLE "githubagent"."pr_commits" DROP CONSTRAINT "FK_b2919fc7c2dc1d0e97118d04bbd"`);
        await queryRunner.query(`ALTER TABLE "githubagent"."pr_files" DROP CONSTRAINT "FK_78a829ba8f68507cbef73f0dcb2"`);
        await queryRunner.query(`ALTER TABLE "githubagent"."chat_messages" DROP CONSTRAINT "FK_dbda1a146c3d74433ed90923f66"`);
        await queryRunner.query(`ALTER TABLE "githubagent"."user_sessions" DROP CONSTRAINT "FK_e9658e959c490b0a634dfc54783"`);
        await queryRunner.query(`ALTER TABLE "githubagent"."auth_providers" DROP CONSTRAINT "FK_262996fd08ab5a69e85b53d0055"`);
        await queryRunner.query(`DROP TABLE "githubagent"."review_findings"`);
        await queryRunner.query(`DROP TYPE "githubagent"."review_findings_severity_enum"`);
        await queryRunner.query(`DROP TYPE "githubagent"."review_findings_category_enum"`);
        await queryRunner.query(`DROP TABLE "githubagent"."pr_reviews"`);
        await queryRunner.query(`DROP TYPE "githubagent"."pr_reviews_status_enum"`);
        await queryRunner.query(`DROP TABLE "githubagent"."pr_commits"`);
        await queryRunner.query(`DROP TABLE "githubagent"."pr_files"`);
        await queryRunner.query(`DROP TYPE "githubagent"."pr_files_change_type_enum"`);
        await queryRunner.query(`DROP TABLE "githubagent"."chat_messages"`);
        await queryRunner.query(`DROP TYPE "githubagent"."chat_messages_sender_enum"`);
        await queryRunner.query(`DROP TABLE "githubagent"."repositories"`);
        await queryRunner.query(`DROP TABLE "githubagent"."user_sessions"`);
        await queryRunner.query(`DROP TYPE "githubagent"."user_sessions_status_enum"`);
        await queryRunner.query(`DROP TABLE "githubagent"."users"`);
        await queryRunner.query(`DROP TABLE "githubagent"."auth_providers"`);
        await queryRunner.query(`DROP TYPE "githubagent"."auth_providers_provider_enum"`);
    }

}
