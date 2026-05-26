-- CreateEnum
CREATE TYPE "VoiceStyle" AS ENUM ('MASCULINA', 'FEMININA');

-- CreateEnum
CREATE TYPE "DispatchStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "liturgies" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "rawText" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "liturgies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reflections" (
    "id" TEXT NOT NULL,
    "liturgyId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reflections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audios" (
    "id" TEXT NOT NULL,
    "liturgyId" TEXT NOT NULL,
    "voiceStyle" "VoiceStyle" NOT NULL,
    "filePath" TEXT NOT NULL,
    "durationSec" INTEGER,
    "provider" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatches" (
    "id" TEXT NOT NULL,
    "liturgyId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "status" "DispatchStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_sessions" (
    "id" TEXT NOT NULL,
    "authState" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "liturgies_date_key" ON "liturgies"("date");

-- CreateIndex
CREATE UNIQUE INDEX "reflections_liturgyId_key" ON "reflections"("liturgyId");

-- CreateIndex
CREATE UNIQUE INDEX "audios_liturgyId_voiceStyle_key" ON "audios"("liturgyId", "voiceStyle");

-- CreateIndex
CREATE INDEX "dispatches_status_createdAt_idx" ON "dispatches"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "reflections" ADD CONSTRAINT "reflections_liturgyId_fkey" FOREIGN KEY ("liturgyId") REFERENCES "liturgies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audios" ADD CONSTRAINT "audios_liturgyId_fkey" FOREIGN KEY ("liturgyId") REFERENCES "liturgies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_liturgyId_fkey" FOREIGN KEY ("liturgyId") REFERENCES "liturgies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
