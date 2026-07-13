-- Add category tracking and a shared training course catalog to certifications.
ALTER TABLE "Certification" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'qualification';
ALTER TABLE "Certification" ADD COLUMN "courseId" TEXT;

CREATE INDEX "Certification_category_idx" ON "Certification"("category");

CREATE TABLE "TrainingCourse" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "provider" TEXT,
    "category" TEXT NOT NULL DEFAULT 'safety',
    "validityDays" INTEGER,
    "description" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT,

    CONSTRAINT "TrainingCourse_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TrainingCourse_category_idx" ON "TrainingCourse"("category");
CREATE INDEX "TrainingCourse_archivedAt_idx" ON "TrainingCourse"("archivedAt");
CREATE INDEX "TrainingCourse_organizationId_idx" ON "TrainingCourse"("organizationId");

ALTER TABLE "Certification" ADD CONSTRAINT "Certification_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "TrainingCourse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
