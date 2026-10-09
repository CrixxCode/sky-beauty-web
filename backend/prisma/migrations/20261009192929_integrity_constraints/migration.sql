-- Restricciones de integridad que Prisma no puede expresar en el esquema.
-- Son la última línea de defensa: la aplicación valida antes, pero la base de datos
-- garantiza que nunca existan stocks negativos ni importes inválidos, incluso ante
-- errores de programación o concurrencia.

ALTER TABLE "ProductVariant"
  ADD CONSTRAINT "ProductVariant_stock_non_negative" CHECK ("stock" >= 0),
  ADD CONSTRAINT "ProductVariant_low_stock_threshold_non_negative" CHECK ("lowStockThreshold" >= 0),
  ADD CONSTRAINT "ProductVariant_price_non_negative" CHECK ("price" IS NULL OR "price" >= 0);

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_base_price_non_negative" CHECK ("basePrice" >= 0);

ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT "InventoryMovement_quantity_non_zero" CHECK ("quantity" <> 0),
  ADD CONSTRAINT "InventoryMovement_stock_after_consistent" CHECK ("stockAfter" = "stockBefore" + "quantity"),
  ADD CONSTRAINT "InventoryMovement_stock_after_non_negative" CHECK ("stockAfter" >= 0);

ALTER TABLE "Promotion"
  ADD CONSTRAINT "Promotion_discount_value_positive" CHECK ("discountValue" > 0),
  ADD CONSTRAINT "Promotion_percentage_max" CHECK ("discountType" <> 'PERCENTAGE' OR "discountValue" <= 90),
  ADD CONSTRAINT "Promotion_dates_valid" CHECK ("endsAt" > "startsAt");

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_amounts_non_negative" CHECK (
    "subtotal" >= 0 AND "discountTotal" >= 0 AND "shippingCost" >= 0 AND "total" >= 0
  ),
  ADD CONSTRAINT "Order_total_consistent" CHECK ("total" = "subtotal" - "discountTotal" + "shippingCost");

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "OrderItem_prices_non_negative" CHECK (
    "unitListPrice" >= 0 AND "unitDiscount" >= 0 AND "unitFinalPrice" >= 0 AND "lineTotal" >= 0
  ),
  ADD CONSTRAINT "OrderItem_line_total_consistent" CHECK ("lineTotal" = "unitFinalPrice" * "quantity");

ALTER TABLE "PaymentRecord"
  ADD CONSTRAINT "PaymentRecord_amount_non_negative" CHECK ("amount" >= 0);

ALTER TABLE "StoreSettings"
  ADD CONSTRAINT "StoreSettings_single_row" CHECK ("id" = 'default'),
  ADD CONSTRAINT "StoreSettings_shipping_non_negative" CHECK (
    "shippingFlatRate" >= 0 AND ("freeShippingThreshold" IS NULL OR "freeShippingThreshold" >= 0)
  );

-- Búsqueda de productos por nombre sin distinguir mayúsculas ni tildes.
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
