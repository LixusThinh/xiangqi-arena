-- CreateEnum
CREATE TYPE "AiGameLevel" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "AiGameStatus" AS ENUM ('IN_PROGRESS', 'FINISHED');

-- CreateTable
CREATE TABLE "ai_games" (
    "ai_game_id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "level" "AiGameLevel" NOT NULL,
    "player_color" VARCHAR(1) NOT NULL,
    "initial_fen" TEXT NOT NULL,
    "moves" JSONB NOT NULL DEFAULT '[]',
    "current_fen" TEXT NOT NULL,
    "ply_count" INTEGER NOT NULL DEFAULT 0,
    "status" "AiGameStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "result" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ai_games_pkey" PRIMARY KEY ("ai_game_id")
);

-- CreateIndex
CREATE INDEX "ai_games_user_id_status_updated_at_idx" ON "ai_games"("user_id", "status", "updated_at");

-- AddForeignKey
ALTER TABLE "ai_games" ADD CONSTRAINT "ai_games_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
