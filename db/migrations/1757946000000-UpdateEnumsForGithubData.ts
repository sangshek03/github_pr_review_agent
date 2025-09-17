import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateEnumsForGithubData1757946000000 implements MigrationInterface {
    name = 'UpdateEnumsForGithubData1757946000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Update file change type enum to include all GitHub status values
        await queryRunner.query(`ALTER TYPE "githubagent"."pr_files_change_type_enum" ADD VALUE IF NOT EXISTS 'removed'`);
        await queryRunner.query(`ALTER TYPE "githubagent"."pr_files_change_type_enum" ADD VALUE IF NOT EXISTS 'changed'`);
        await queryRunner.query(`ALTER TYPE "githubagent"."pr_files_change_type_enum" ADD VALUE IF NOT EXISTS 'copied'`);

        // Update GitHub ID columns to bigint to handle large IDs
        await queryRunner.query(`ALTER TABLE "githubagent"."pr_metadata" ALTER COLUMN "github_pr_id" TYPE bigint USING "github_pr_id"::bigint`);
        await queryRunner.query(`ALTER TABLE "githubagent"."github_users" ALTER COLUMN "github_id" TYPE bigint USING "github_id"::bigint`);
        await queryRunner.query(`ALTER TABLE "githubagent"."github_pr_reviews" ALTER COLUMN "github_review_id" TYPE bigint USING "github_review_id"::bigint`);
        await queryRunner.query(`ALTER TABLE "githubagent"."pr_comments" ALTER COLUMN "github_comment_id" TYPE bigint USING "github_comment_id"::bigint`);
        await queryRunner.query(`ALTER TABLE "githubagent"."repositories" ALTER COLUMN "github_repo_id" TYPE bigint USING "github_repo_id"::bigint`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Note: Cannot remove enum values easily in PostgreSQL, would need to recreate the enum
        // For now, we'll leave the enum values as they are

        // Revert GitHub ID columns back to int (this may fail if values are too large)
        await queryRunner.query(`ALTER TABLE "githubagent"."repositories" ALTER COLUMN "github_repo_id" TYPE int USING "github_repo_id"::int`);
        await queryRunner.query(`ALTER TABLE "githubagent"."pr_comments" ALTER COLUMN "github_comment_id" TYPE int USING "github_comment_id"::int`);
        await queryRunner.query(`ALTER TABLE "githubagent"."github_pr_reviews" ALTER COLUMN "github_review_id" TYPE int USING "github_review_id"::int`);
        await queryRunner.query(`ALTER TABLE "githubagent"."github_users" ALTER COLUMN "github_id" TYPE int USING "github_id"::int`);
        await queryRunner.query(`ALTER TABLE "githubagent"."pr_metadata" ALTER COLUMN "github_pr_id" TYPE int USING "github_pr_id"::int`);
    }
}