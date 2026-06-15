-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('TEAM', 'CLIENT');

-- CreateEnum
CREATE TYPE "ProjectMode" AS ENUM ('PROJECT', 'ONGOING');

-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('WEBSITE', 'BRANDING', 'MARKETING', 'SOFTWARE_CRM', 'OTHER');

-- CreateEnum
CREATE TYPE "StageStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'GATE_PENDING', 'COMPLETE');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('INTERNAL', 'SHARED');

-- CreateEnum
CREATE TYPE "ApprovalMethod" AS ENUM ('PORTAL', 'EMAIL', 'VERBAL', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'SENT', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('BRIEF', 'IN_PROGRESS', 'REVIEW', 'DONE');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('DELIVERABLE', 'INTERNAL', 'FIX_UPDATE');

-- CreateEnum
CREATE TYPE "CycleStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('CONFIRMED', 'PENDING', 'UNVERIFIED');

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "client_id" UUID NOT NULL,
    "type" "ProjectType" NOT NULL,
    "mode" "ProjectMode" NOT NULL DEFAULT 'PROJECT',
    "current_stage" INTEGER NOT NULL DEFAULT 1,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_stages" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "stage_number" INTEGER NOT NULL,
    "status" "StageStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "gate_approved" BOOLEAN NOT NULL DEFAULT false,
    "gate_approved_at" TIMESTAMP(3),
    "gate_approver_id" UUID,
    "completed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "stage_number" INTEGER NOT NULL,
    "template_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "sent_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "stage_number" INTEGER NOT NULL,
    "approved_by_id" UUID NOT NULL,
    "method" "ApprovalMethod" NOT NULL DEFAULT 'PORTAL',
    "notes" TEXT,
    "approved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "asset_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_assets" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "stage_number" INTEGER,
    "storage_path" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "visibility" "Visibility" NOT NULL DEFAULT 'INTERNAL',
    "version" INTEGER NOT NULL DEFAULT 1,
    "uploaded_by" UUID NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "project_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_items" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "file_ref" TEXT,
    "notes" TEXT,
    "due_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycles" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "status" "CycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "cycle_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TaskType" NOT NULL DEFAULT 'DELIVERABLE',
    "status" "TaskStatus" NOT NULL DEFAULT 'BRIEF',
    "description" TEXT,
    "assignee_id" UUID,
    "due_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "company_id" TEXT,
    "company_name" TEXT,
    "brand_name" TEXT,
    "industry" TEXT,
    "sub_industry" TEXT,
    "founded_year" INTEGER,
    "geographic_market" TEXT,
    "website_url" TEXT,
    "market_positioning" TEXT,
    "brand_essence" TEXT,
    "key_differentiators" TEXT,
    "current_challenge" TEXT,
    "business_type" TEXT,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "service_id" TEXT,
    "service_name" TEXT,
    "category" TEXT,
    "description" TEXT,
    "price_min" DOUBLE PRECISION,
    "price_max" DOUBLE PRECISION,
    "price_currency" TEXT,
    "is_most_popular" BOOLEAN,
    "is_most_profitable" BOOLEAN,
    "target_persona" TEXT,
    "funnel_stage_ref" TEXT,
    "notes" TEXT,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "contact_id" TEXT,
    "type" TEXT,
    "platform" TEXT,
    "value" TEXT,
    "is_primary" BOOLEAN,
    "is_public" BOOLEAN,
    "verified" BOOLEAN DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_stats" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "stat_id" TEXT,
    "stat_name" TEXT,
    "stat_value" TEXT,
    "stat_unit" TEXT,
    "source" TEXT,
    "date_captured" TIMESTAMP(3),
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,

    CONSTRAINT "company_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitors" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "competitor_id" TEXT,
    "name" TEXT,
    "website" TEXT,
    "market_positioning" TEXT,
    "price_range" TEXT,
    "why_audience_uses" TEXT,
    "their_strength" TEXT,
    "their_weakness" TEXT,
    "our_opportunity" TEXT,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "competitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "goal_id" TEXT,
    "goal_level" TEXT,
    "parent_goal_id" TEXT,
    "goal_description" TEXT,
    "timeframe" TEXT,
    "success_metric" TEXT,
    "current_status" TEXT DEFAULT 'not started',
    "priority" INTEGER,
    "notes" TEXT,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "budget_id" TEXT,
    "channel" TEXT,
    "monthly_allocation" DOUBLE PRECISION,
    "currency" TEXT,
    "percentage_of_total" DOUBLE PRECISION,
    "priority_level" TEXT,
    "notes" TEXT,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_modifiers" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "modifier_id" TEXT,
    "type" TEXT,
    "name" TEXT,
    "description" TEXT,
    "value" DOUBLE PRECISION,
    "value_type" TEXT,
    "conditions" TEXT,
    "active" BOOLEAN DEFAULT true,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "pricing_modifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_queue" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "item_id" TEXT,
    "table_reference" TEXT,
    "field_name" TEXT,
    "current_value" TEXT,
    "question_for_client" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resolved_value" TEXT,
    "date_raised" TIMESTAMP(3),
    "date_resolved" TIMESTAMP(3),

    CONSTRAINT "verification_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_specific_data" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "table_type" TEXT,
    "data" JSONB NOT NULL,

    CONSTRAINT "client_specific_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "persona_groups" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "group_id" TEXT,
    "group_name" TEXT,
    "age_range" TEXT,
    "shared_characteristic" TEXT,
    "size_estimate" TEXT,
    "priority_level" TEXT,
    "notes" TEXT,

    CONSTRAINT "persona_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personas" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "group_id" UUID,
    "persona_id" TEXT,
    "persona_name" TEXT,
    "age_range" TEXT,
    "gender" TEXT,
    "location" TEXT,
    "occupation" TEXT,
    "income_level" TEXT,
    "core_values" TEXT,
    "intro_extrovert" INTEGER,
    "practical_aspirational" INTEGER,

    CONSTRAINT "personas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pain_points" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "persona_id" UUID,
    "pain_id" TEXT,
    "pain_description" TEXT,
    "severity" INTEGER,
    "category" TEXT,
    "surfaces_at_stage" TEXT,
    "strategic_implication" TEXT,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "pain_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "needs" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "persona_id" UUID,
    "need_id" TEXT,
    "need_description" TEXT,
    "priority" INTEGER,
    "need_type" TEXT,
    "priority_at_stage" TEXT,
    "notes" TEXT,

    CONSTRAINT "needs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benefits" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "persona_id" UUID,
    "service_id" UUID,
    "benefit_id" TEXT,
    "benefit_description" TEXT,
    "proof_point" TEXT,
    "resonates_at_stage" TEXT,
    "priority" INTEGER,
    "notes" TEXT,

    CONSTRAINT "benefits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objections" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "persona_id" UUID,
    "objection_id" TEXT,
    "objection_text" TEXT,
    "objection_type" TEXT,
    "response_text" TEXT,
    "arises_at_stage" TEXT,
    "priority" INTEGER,
    "notes" TEXT,

    CONSTRAINT "objections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "key_messages" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "persona_id" UUID,
    "message_id" TEXT,
    "message_text" TEXT,
    "message_type" TEXT,
    "tone_notes" TEXT,
    "use_at_stage" TEXT,
    "channel_suitability" TEXT,
    "approved" TEXT DEFAULT 'pending',
    "notes" TEXT,

    CONSTRAINT "key_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slogans" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "slogan_id" TEXT,
    "slogan_text" TEXT,
    "type" TEXT,
    "persona_fit" TEXT,
    "best_for_stage" TEXT,
    "approved" TEXT DEFAULT 'pending',
    "usage_notes" TEXT,

    CONSTRAINT "slogans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_voice_observations" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "observation_id" TEXT,
    "type" TEXT,
    "observation" TEXT,
    "example" TEXT,
    "applies_to_channel" TEXT,
    "rationale" TEXT,
    "priority" TEXT,
    "source" TEXT,

    CONSTRAINT "brand_voice_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategic_objectives" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "objective_id" TEXT,
    "level" TEXT,
    "parent_objective_id" TEXT,
    "objective_text" TEXT,
    "timeframe" TEXT,
    "owner" TEXT,
    "priority" INTEGER,
    "status" TEXT DEFAULT 'not started',
    "notes" TEXT,

    CONSTRAINT "strategic_objectives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "initiatives" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "objective_id" UUID,
    "initiative_id" TEXT,
    "initiative_name" TEXT,
    "description" TEXT,
    "viability_score" INTEGER,
    "effort_score" INTEGER,
    "priority_score" INTEGER,
    "status" TEXT DEFAULT 'proposed',
    "timeline" TEXT,
    "budget_estimate" TEXT,
    "notes" TEXT,

    CONSTRAINT "initiatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cross_cutting_initiatives" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "initiative_id" TEXT,
    "name" TEXT,
    "description" TEXT,
    "objectives_served" TEXT,
    "type" TEXT,
    "status" TEXT DEFAULT 'proposed',
    "timeline" TEXT,
    "notes" TEXT,

    CONSTRAINT "cross_cutting_initiatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cross_cutting_deployments" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "deployment_id" TEXT,
    "initiative_id" UUID,
    "channel" TEXT,
    "asset_type" TEXT,
    "deployment_frequency" TEXT,
    "status" TEXT DEFAULT 'planned',
    "notes" TEXT,

    CONSTRAINT "cross_cutting_deployments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "key_results" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "objective_id" UUID,
    "kr_id" TEXT,
    "level" INTEGER,
    "kr_description" TEXT,
    "measurement_type" TEXT,
    "baseline" TEXT,
    "target" TEXT,
    "current_value" TEXT,
    "deadline" TIMESTAMP(3),
    "status" TEXT DEFAULT 'on track',
    "notes" TEXT,

    CONSTRAINT "key_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cross_cutting_krs" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "initiative_id" UUID,
    "kr_id" TEXT,
    "metric_name" TEXT,
    "measurement_type" TEXT,
    "baseline" DOUBLE PRECISION,
    "target" DOUBLE PRECISION,
    "current_value" DOUBLE PRECISION,
    "frequency" TEXT,
    "status" TEXT DEFAULT 'on track',
    "notes" TEXT,

    CONSTRAINT "cross_cutting_krs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funnel_stages" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "stage_id" TEXT,
    "stage_name" TEXT,
    "stage_order" INTEGER,
    "stage_description" TEXT,
    "entry_criteria" TEXT,
    "exit_criteria" TEXT,
    "key_content_types" TEXT,
    "key_metrics" TEXT,
    "notes" TEXT,

    CONSTRAINT "funnel_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_entries" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "calendar_id" TEXT,
    "period_type" TEXT,
    "period_label" TEXT,
    "theme" TEXT,
    "focus_area" TEXT,
    "key_campaigns" TEXT,
    "content_priorities" TEXT,
    "channel_focus" TEXT,
    "notes" TEXT,

    CONSTRAINT "calendar_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risks" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "risk_id" TEXT,
    "risk_category" TEXT,
    "risk_description" TEXT,
    "probability" INTEGER,
    "impact" INTEGER,
    "risk_score" INTEGER,
    "mitigation_strategy" TEXT,
    "contingency_plan" TEXT,
    "owner" TEXT,
    "status" TEXT DEFAULT 'active',
    "notes" TEXT,

    CONSTRAINT "risks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_email_key" ON "profiles"("email");

-- CreateIndex
CREATE UNIQUE INDEX "project_stages_project_id_stage_number_key" ON "project_stages"("project_id", "stage_number");

-- CreateIndex
CREATE UNIQUE INDEX "company_project_id_key" ON "company"("project_id");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_stages" ADD CONSTRAINT "project_stages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_stages" ADD CONSTRAINT "project_stages_gate_approver_id_fkey" FOREIGN KEY ("gate_approver_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_assets" ADD CONSTRAINT "project_assets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_items" ADD CONSTRAINT "material_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycles" ADD CONSTRAINT "cycles_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company" ADD CONSTRAINT "company_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_stats" ADD CONSTRAINT "company_stats_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitors" ADD CONSTRAINT "competitors_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget" ADD CONSTRAINT "budget_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_modifiers" ADD CONSTRAINT "pricing_modifiers_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_queue" ADD CONSTRAINT "verification_queue_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_specific_data" ADD CONSTRAINT "client_specific_data_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persona_groups" ADD CONSTRAINT "persona_groups_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personas" ADD CONSTRAINT "personas_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personas" ADD CONSTRAINT "personas_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "persona_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pain_points" ADD CONSTRAINT "pain_points_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pain_points" ADD CONSTRAINT "pain_points_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "personas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "needs" ADD CONSTRAINT "needs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "needs" ADD CONSTRAINT "needs_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "personas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefits" ADD CONSTRAINT "benefits_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefits" ADD CONSTRAINT "benefits_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "personas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objections" ADD CONSTRAINT "objections_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objections" ADD CONSTRAINT "objections_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "personas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "key_messages" ADD CONSTRAINT "key_messages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "key_messages" ADD CONSTRAINT "key_messages_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "personas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slogans" ADD CONSTRAINT "slogans_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_voice_observations" ADD CONSTRAINT "brand_voice_observations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategic_objectives" ADD CONSTRAINT "strategic_objectives_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiatives" ADD CONSTRAINT "initiatives_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiatives" ADD CONSTRAINT "initiatives_objective_id_fkey" FOREIGN KEY ("objective_id") REFERENCES "strategic_objectives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cross_cutting_initiatives" ADD CONSTRAINT "cross_cutting_initiatives_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cross_cutting_deployments" ADD CONSTRAINT "cross_cutting_deployments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cross_cutting_deployments" ADD CONSTRAINT "cross_cutting_deployments_initiative_id_fkey" FOREIGN KEY ("initiative_id") REFERENCES "cross_cutting_initiatives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "key_results" ADD CONSTRAINT "key_results_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "key_results" ADD CONSTRAINT "key_results_objective_id_fkey" FOREIGN KEY ("objective_id") REFERENCES "strategic_objectives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cross_cutting_krs" ADD CONSTRAINT "cross_cutting_krs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cross_cutting_krs" ADD CONSTRAINT "cross_cutting_krs_initiative_id_fkey" FOREIGN KEY ("initiative_id") REFERENCES "cross_cutting_initiatives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funnel_stages" ADD CONSTRAINT "funnel_stages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_entries" ADD CONSTRAINT "calendar_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risks" ADD CONSTRAINT "risks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
