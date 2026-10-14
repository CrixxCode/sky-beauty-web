-- El seguimiento busca el pedido por el hash de su token: índice único en lugar de recorrer la tabla.
CREATE UNIQUE INDEX "Order_publicTokenHash_key" ON "Order"("publicTokenHash");
