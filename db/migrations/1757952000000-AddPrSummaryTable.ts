import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPrSummaryTable1757952000000 implements MigrationInterface {
    name = 'AddPrSummaryTable1757952000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "githubagent"."pr_summary" (
                "pr_summary_id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "summary" text NOT NULL,
                "issues_found" jsonb NOT NULL,
                "suggestions" jsonb NOT NULL,
                "test_recommendations" jsonb NOT NULL,
                "overall_score" integer NOT NULL DEFAULT '0',
                "security_concerns" jsonb NOT NULL,
                "performance_issues" jsonb NOT NULL,
                "well_handled_cases" jsonb NOT NULL,
                "future_enhancements" jsonb NOT NULL,
                "code_quality_rating" jsonb NOT NULL,
                "analysis_model" character varying(50),
                "analysis_timestamp" TIMESTAMP,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP,
                "user_id" uuid,
                "pr_review_id" uuid,
                CONSTRAINT "PK_pr_summary_id" PRIMARY KEY ("pr_summary_id")
            )
        `);

        await queryRunner.query(`
            ALTER TABLE "githubagent"."pr_summary"
            ADD CONSTRAINT "FK_pr_summary_user_id"
            FOREIGN KEY ("user_id")
            REFERENCES "githubagent"."users"("user_id")
            ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "githubagent"."pr_summary"
            ADD CONSTRAINT "FK_pr_summary_pr_review_id"
            FOREIGN KEY ("pr_review_id")
            REFERENCES "githubagent"."pr_reviews"("pr_review_id")
            ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "githubagent"."pr_summary" DROP CONSTRAINT "FK_pr_summary_pr_review_id"`);
        await queryRunner.query(`ALTER TABLE "githubagent"."pr_summary" DROP CONSTRAINT "FK_pr_summary_user_id"`);
        await queryRunner.query(`DROP TABLE "githubagent"."pr_summary"`);
    }
}