-- Tope general de unidades de una misma variante por pedido (null = sin tope general).
ALTER TABLE "StoreSettings" ADD COLUMN "maxUnitsPerProduct" INTEGER;
