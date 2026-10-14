/** Pendientes del Resumen (GET /admin/dashboard/pending). */
export interface DashboardPending {
  ordersToConfirm: number;
  paymentsToVerify: number;
  noticesToSend: number;
  lowStockVariants: number;
}
