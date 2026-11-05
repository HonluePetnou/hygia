-- CreateTable
CREATE TABLE "fhir_resource" (
    "resource_type" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "patient_id" TEXT,
    "version" INTEGER NOT NULL,
    "body" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fhir_resource_pkey" PRIMARY KEY ("resource_type","id")
);

-- CreateIndex
CREATE INDEX "fhir_resource_patient_id_idx" ON "fhir_resource"("patient_id");
