-- La dirección pública de cada foto se calcula a partir de su clave (src/shared/uploads.ts); guardar
-- la URL completa ataba las fotos al dominio con que se subieron.
ALTER TABLE "ProductImage" DROP COLUMN "url",
DROP COLUMN "thumbnailUrl";
