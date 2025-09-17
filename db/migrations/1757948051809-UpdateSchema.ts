import { MigrationInterface, QueryRunner } from "typeorm";

export class  UpdateSchema1757948051809 implements MigrationInterface {
    name = ' UpdateSchema1757948051809'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "githubagent"."repositories" DROP CONSTRAINT "UQ_1737947e7f09f3968cb93720f67"`);
        await queryRunner.query(`ALTER TABLE "githubagent"."repositories" DROP COLUMN "github_repo_id"`);
        await queryRunner.query(`ALTER TABLE "githubagent"."repositories" ADD "github_repo_id" bigint NOT NULL`);
        await queryRunner.query(`ALTER TABLE "githubagent"."repositories" ADD CONSTRAINT "UQ_1737947e7f09f3968cb93720f67" UNIQUE ("github_repo_id")`);
        await queryRunner.query(`DROP INDEX "githubagent"."IDX_2275c60a7e592d4885ec080f84"`);
        await queryRunner.query(`ALTER TABLE "githubagent"."github_pr_reviews" DROP CONSTRAINT "UQ_2275c60a7e592d4885ec080f84f"`);
        await queryRunner.query(`ALTER TABLE "githubagent"."github_pr_reviews" DROP COLUMN "github_review_id"`);
        await queryRunner.query(`ALTER TABLE "githubagent"."github_pr_reviews" ADD "github_review_id" bigint NOT NULL`);
        await queryRunner.query(`ALTER TABLE "githubagent"."github_pr_reviews" ADD CONSTRAINT "UQ_2275c60a7e592d4885ec080f84f" UNIQUE ("github_review_id")`);
        await queryRunner.query(`DROP INDEX "githubagent"."IDX_f9a5a8d3646e8a0d58d2bdc50a"`);
        await queryRunner.query(`ALTER TABLE "githubagent"."pr_comments" DROP CONSTRAINT "UQ_f9a5a8d3646e8a0d58d2bdc50a5"`);
        await queryRunner.query(`ALTER TABLE "githubagent"."pr_comments" DROP COLUMN "github_comment_id"`);
        await queryRunner.query(`ALTER TABLE "githubagent"."pr_comments" ADD "github_comment_id" bigint NOT NULL`);
        await queryRunner.query(`ALTER TABLE "githubagent"."pr_comments" ADD CONSTRAINT "UQ_f9a5a8d3646e8a0d58d2bdc50a5" UNIQUE ("github_comment_id")`);
        await queryRunner.query(`DROP INDEX "githubagent"."IDX_7655d3e8b05e9f4f127df0006d"`);
        await queryRunner.query(`ALTER TABLE "githubagent"."pr_metadata" DROP COLUMN "github_pr_id"`);
        await queryRunner.query(`ALTER TABLE "githubagent"."pr_metadata" ADD "github_pr_id" bigint NOT NULL`);
        await queryRunner.query(`DROP INDEX "githubagent"."IDX_fcb2858c19c84091f544628555"`);
        await queryRunner.query(`ALTER TABLE "githubagent"."github_users" DROP CONSTRAINT "UQ_fcb2858c19c84091f544628555f"`);
        await queryRunner.query(`ALTER TABLE "githubagent"."github_users" DROP COLUMN "github_id"`);
        await queryRunner.query(`ALTER TABLE "githubagent"."github_users" ADD "github_id" bigint NOT NULL`);
        await queryRunner.query(`ALTER TABLE "githubagent"."github_users" ADD CONSTRAINT "UQ_fcb2858c19c84091f544628555f" UNIQUE ("github_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_2275c60a7e592d4885ec080f84" ON "githubagent"."github_pr_reviews" ("github_review_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_f9a5a8d3646e8a0d58d2bdc50a" ON "githubagent"."pr_comments" ("github_comment_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_7655d3e8b05e9f4f127df0006d" ON "githubagent"."pr_metadata" ("github_pr_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_fcb2858c19c84091f544628555" ON "githubagent"."github_users" ("github_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "githubagent"."IDX_fcb2858c19c84091f544628555"`);
        await queryRunner.query(`DROP INDEX "githubagent"."IDX_7655d3e8b05e9f4f127df0006d"`);
        await queryRunner.query(`DROP INDEX "githubagent"."IDX_f9a5a8d3646e8a0d58d2bdc50a"`);
        await queryRunner.query(`DROP INDEX "githubagent"."IDX_2275c60a7e592d4885ec080f84"`);
        await queryRunner.query(`ALTER TABLE "githubagent"."github_users" DROP CONSTRAINT "UQ_fcb2858c19c84091f544628555f"`);
        await queryRunner.query(`ALTER TABLE "githubagent"."github_users" DROP COLUMN "github_id"`);
        await queryRunner.query(`ALTER TABLE "githubagent"."github_users" ADD "github_id" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "githubagent"."github_users" ADD CONSTRAINT "UQ_fcb2858c19c84091f544628555f" UNIQUE ("github_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_fcb2858c19c84091f544628555" ON "githubagent"."github_users" ("github_id") `);
        await queryRunner.query(`ALTER TABLE "githubagent"."pr_metadata" DROP COLUMN "github_pr_id"`);
        await queryRunner.query(`ALTER TABLE "githubagent"."pr_metadata" ADD "github_pr_id" integer NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_7655d3e8b05e9f4f127df0006d" ON "githubagent"."pr_metadata" ("github_pr_id") `);
        await queryRunner.query(`ALTER TABLE "githubagent"."pr_comments" DROP CONSTRAINT "UQ_f9a5a8d3646e8a0d58d2bdc50a5"`);
        await queryRunner.query(`ALTER TABLE "githubagent"."pr_comments" DROP COLUMN "github_comment_id"`);
        await queryRunner.query(`ALTER TABLE "githubagent"."pr_comments" ADD "github_comment_id" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "githubagent"."pr_comments" ADD CONSTRAINT "UQ_f9a5a8d3646e8a0d58d2bdc50a5" UNIQUE ("github_comment_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_f9a5a8d3646e8a0d58d2bdc50a" ON "githubagent"."pr_comments" ("github_comment_id") `);
        await queryRunner.query(`ALTER TABLE "githubagent"."github_pr_reviews" DROP CONSTRAINT "UQ_2275c60a7e592d4885ec080f84f"`);
        await queryRunner.query(`ALTER TABLE "githubagent"."github_pr_reviews" DROP COLUMN "github_review_id"`);
        await queryRunner.query(`ALTER TABLE "githubagent"."github_pr_reviews" ADD "github_review_id" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "githubagent"."github_pr_reviews" ADD CONSTRAINT "UQ_2275c60a7e592d4885ec080f84f" UNIQUE ("github_review_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_2275c60a7e592d4885ec080f84" ON "githubagent"."github_pr_reviews" ("github_review_id") `);
        await queryRunner.query(`ALTER TABLE "githubagent"."repositories" DROP CONSTRAINT "UQ_1737947e7f09f3968cb93720f67"`);
        await queryRunner.query(`ALTER TABLE "githubagent"."repositories" DROP COLUMN "github_repo_id"`);
        await queryRunner.query(`ALTER TABLE "githubagent"."repositories" ADD "github_repo_id" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "githubagent"."repositories" ADD CONSTRAINT "UQ_1737947e7f09f3968cb93720f67" UNIQUE ("github_repo_id")`);
    }

}
