import { markOverdueLoans } from "@/modules/loans-transfers";

export async function runLoansOverdueScanJob(organizationId: string) {
  return markOverdueLoans(organizationId);
}
