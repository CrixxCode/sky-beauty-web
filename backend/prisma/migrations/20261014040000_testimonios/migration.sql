-- Testimonios registrados por la propietaria (decisión del 2026-10-14).
CREATE TABLE "Testimonial" (
    "id" UUID NOT NULL,
    "firstName" VARCHAR(60) NOT NULL,
    "lastInitial" VARCHAR(1) NOT NULL,
    "rating" SMALLINT NOT NULL,
    "comment" VARCHAR(600) NOT NULL,
    "productId" UUID,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Testimonial_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Testimonial_rating_range" CHECK ("rating" BETWEEN 1 AND 5)
);

CREATE INDEX "Testimonial_isPublished_createdAt_idx" ON "Testimonial"("isPublished", "createdAt");

ALTER TABLE "Testimonial" ADD CONSTRAINT "Testimonial_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
