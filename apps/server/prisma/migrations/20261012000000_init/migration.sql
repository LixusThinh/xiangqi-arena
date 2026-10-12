-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PLAYER', 'ADMIN');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'LOCKED');

-- CreateEnum
CREATE TYPE "RoomVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "HostColorPref" AS ENUM ('RED', 'BLACK', 'RANDOM');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('WAITING', 'PLAYING', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('WAITING', 'ACTIVE', 'FINISHED', 'ABORTED');

-- CreateEnum
CREATE TYPE "MatchResult" AS ENUM ('RED_WIN', 'BLACK_WIN', 'DRAW');

-- CreateEnum
CREATE TYPE "MatchEndReason" AS ENUM ('CHECKMATE', 'STALEMATE', 'RESIGNATION', 'TIMEOUT', 'DISCONNECT', 'DRAW_AGREEMENT', 'REPETITION', 'MOVE_LIMIT');

-- CreateEnum
CREATE TYPE "DrawOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ChatType" AS ENUM ('TEXT', 'EMOJI');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('CHEATING', 'HARASSMENT', 'SPAM', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'PROCESSING', 'CLOSED');

-- CreateTable
CREATE TABLE "users" (
    "user_id" BIGSERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "display_name" VARCHAR(80) NOT NULL,
    "avatar_url" VARCHAR(2048),
    "bio" VARCHAR(500),
    "role" "UserRole" NOT NULL DEFAULT 'PLAYER',
    "account_status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "rating" INTEGER NOT NULL DEFAULT 1200,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "rule_profiles" (
    "rule_profile_id" SERIAL NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "base_time_sec" INTEGER NOT NULL,
    "increment_sec" INTEGER NOT NULL,
    "natural_move_limit" INTEGER NOT NULL,
    "repetition_threshold" INTEGER NOT NULL,
    "reconnect_grace_sec" INTEGER NOT NULL,
    "is_ranked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "rule_profiles_pkey" PRIMARY KEY ("rule_profile_id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "room_id" BIGSERIAL NOT NULL,
    "room_code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "host_id" BIGINT NOT NULL,
    "visibility" "RoomVisibility" NOT NULL DEFAULT 'PUBLIC',
    "host_color_pref" "HostColorPref" NOT NULL DEFAULT 'RANDOM',
    "rule_profile_id" INTEGER NOT NULL,
    "status" "RoomStatus" NOT NULL DEFAULT 'WAITING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("room_id")
);

-- CreateTable
CREATE TABLE "room_members" (
    "room_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "is_ready" BOOLEAN NOT NULL DEFAULT false,
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_members_pkey" PRIMARY KEY ("room_id","user_id")
);

-- CreateTable
CREATE TABLE "matches" (
    "match_id" BIGSERIAL NOT NULL,
    "room_id" BIGINT NOT NULL,
    "red_player_id" BIGINT NOT NULL,
    "black_player_id" BIGINT NOT NULL,
    "rule_profile_id" INTEGER NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'WAITING',
    "result" "MatchResult",
    "end_reason" "MatchEndReason",
    "current_fen" TEXT,
    "current_ply" INTEGER NOT NULL DEFAULT 0,
    "red_time_left_ms" BIGINT NOT NULL DEFAULT 0,
    "black_time_left_ms" BIGINT NOT NULL DEFAULT 0,
    "turn_started_at" TIMESTAMPTZ(6),
    "started_at" TIMESTAMPTZ(6),
    "ended_at" TIMESTAMPTZ(6),

    CONSTRAINT "matches_pkey" PRIMARY KEY ("match_id")
);

-- CreateTable
CREATE TABLE "moves" (
    "move_id" BIGSERIAL NOT NULL,
    "match_id" BIGINT NOT NULL,
    "ply" INTEGER NOT NULL,
    "player_id" BIGINT NOT NULL,
    "piece_code" VARCHAR(20) NOT NULL,
    "from_sq" VARCHAR(5) NOT NULL,
    "to_sq" VARCHAR(5) NOT NULL,
    "captured_piece_code" VARCHAR(20),
    "is_check" BOOLEAN NOT NULL DEFAULT false,
    "is_capture" BOOLEAN NOT NULL DEFAULT false,
    "is_irreversible" BOOLEAN NOT NULL DEFAULT false,
    "fen_after" TEXT NOT NULL,
    "position_hash" CHAR(16) NOT NULL,
    "think_time_ms" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moves_pkey" PRIMARY KEY ("move_id")
);

-- CreateTable
CREATE TABLE "draw_offers" (
    "offer_id" BIGSERIAL NOT NULL,
    "match_id" BIGINT NOT NULL,
    "offered_by" BIGINT NOT NULL,
    "at_ply" INTEGER NOT NULL,
    "status" "DrawOfferStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "draw_offers_pkey" PRIMARY KEY ("offer_id")
);

-- CreateTable
CREATE TABLE "chats" (
    "chat_id" BIGSERIAL NOT NULL,
    "room_id" BIGINT NOT NULL,
    "match_id" BIGINT,
    "sender_id" BIGINT NOT NULL,
    "type" "ChatType" NOT NULL DEFAULT 'TEXT',
    "message" VARCHAR(300) NOT NULL,
    "emoji_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chats_pkey" PRIMARY KEY ("chat_id")
);

-- CreateTable
CREATE TABLE "emojis" (
    "emoji_id" SERIAL NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "image_url" VARCHAR(2048) NOT NULL,

    CONSTRAINT "emojis_pkey" PRIMARY KEY ("emoji_id")
);

-- CreateTable
CREATE TABLE "rating_history" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "match_id" BIGINT NOT NULL,
    "rating_before" INTEGER NOT NULL,
    "rating_after" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rating_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "report_id" BIGSERIAL NOT NULL,
    "reporter_id" BIGINT NOT NULL,
    "reported_user_id" BIGINT NOT NULL,
    "match_id" BIGINT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("report_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "rule_profiles_code_key" ON "rule_profiles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_room_code_key" ON "rooms"("room_code");

-- CreateIndex
CREATE INDEX "rooms_host_id_idx" ON "rooms"("host_id");

-- CreateIndex
CREATE INDEX "rooms_status_visibility_idx" ON "rooms"("status", "visibility");

-- CreateIndex
CREATE INDEX "room_members_user_id_idx" ON "room_members"("user_id");

-- CreateIndex
CREATE INDEX "matches_room_id_idx" ON "matches"("room_id");

-- CreateIndex
CREATE INDEX "matches_red_player_id_idx" ON "matches"("red_player_id");

-- CreateIndex
CREATE INDEX "matches_black_player_id_idx" ON "matches"("black_player_id");

-- CreateIndex
CREATE INDEX "matches_status_started_at_idx" ON "matches"("status", "started_at");

-- CreateIndex
CREATE INDEX "moves_player_id_idx" ON "moves"("player_id");

-- CreateIndex
CREATE UNIQUE INDEX "moves_match_id_ply_key" ON "moves"("match_id", "ply");

-- CreateIndex
CREATE INDEX "draw_offers_match_id_status_idx" ON "draw_offers"("match_id", "status");

-- CreateIndex
CREATE INDEX "chats_room_id_created_at_idx" ON "chats"("room_id", "created_at");

-- CreateIndex
CREATE INDEX "chats_match_id_created_at_idx" ON "chats"("match_id", "created_at");

-- CreateIndex
CREATE INDEX "chats_sender_id_idx" ON "chats"("sender_id");

-- CreateIndex
CREATE UNIQUE INDEX "emojis_code_key" ON "emojis"("code");

-- CreateIndex
CREATE INDEX "rating_history_user_id_created_at_idx" ON "rating_history"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "rating_history_match_id_idx" ON "rating_history"("match_id");

-- CreateIndex
CREATE INDEX "reports_reporter_id_created_at_idx" ON "reports"("reporter_id", "created_at");

-- CreateIndex
CREATE INDEX "reports_reported_user_id_status_idx" ON "reports"("reported_user_id", "status");

-- CreateIndex
CREATE INDEX "reports_match_id_idx" ON "reports"("match_id");

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_rule_profile_id_fkey" FOREIGN KEY ("rule_profile_id") REFERENCES "rule_profiles"("rule_profile_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("room_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("room_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_red_player_id_fkey" FOREIGN KEY ("red_player_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_black_player_id_fkey" FOREIGN KEY ("black_player_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_rule_profile_id_fkey" FOREIGN KEY ("rule_profile_id") REFERENCES "rule_profiles"("rule_profile_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moves" ADD CONSTRAINT "moves_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("match_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moves" ADD CONSTRAINT "moves_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draw_offers" ADD CONSTRAINT "draw_offers_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("match_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draw_offers" ADD CONSTRAINT "draw_offers_offered_by_fkey" FOREIGN KEY ("offered_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("room_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("match_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_emoji_id_fkey" FOREIGN KEY ("emoji_id") REFERENCES "emojis"("emoji_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating_history" ADD CONSTRAINT "rating_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating_history" ADD CONSTRAINT "rating_history_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("match_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_user_id_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("match_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "matches"
ADD CONSTRAINT "matches_players_must_differ_check"
CHECK ("red_player_id" <> "black_player_id");

ALTER TABLE "matches"
ADD CONSTRAINT "matches_result_and_end_reason_check"
CHECK (
    ("status" = 'FINISHED' AND "result" IS NOT NULL AND "end_reason" IS NOT NULL)
    OR ("status" <> 'FINISHED' AND "result" IS NULL AND "end_reason" IS NULL)
);

ALTER TABLE "chats"
ADD CONSTRAINT "chats_message_length_check"
CHECK (char_length("message") BETWEEN 1 AND 300);

ALTER TABLE "moves"
ADD CONSTRAINT "moves_position_hash_hex_check"
CHECK ("position_hash" ~ '^[0-9A-Fa-f]{16}$');

ALTER TABLE "moves"
ADD CONSTRAINT "moves_nonnegative_counters_check"
CHECK ("ply" > 0 AND "think_time_ms" >= 0);

ALTER TABLE "matches"
ADD CONSTRAINT "matches_nonnegative_counters_check"
CHECK (
    "current_ply" >= 0
    AND "red_time_left_ms" >= 0
    AND "black_time_left_ms" >= 0
);

ALTER TABLE "rule_profiles"
ADD CONSTRAINT "rule_profiles_nonnegative_settings_check"
CHECK (
    "base_time_sec" > 0
    AND "increment_sec" >= 0
    AND "natural_move_limit" >= 0
    AND "repetition_threshold" > 0
    AND "reconnect_grace_sec" >= 0
);
