import { AppError, jsonError } from "@/shared/kernel/http";

export async function POST() {
  return jsonError(
    new AppError(
      "Use POST /api/v1/uploads/intent (purpose=digitize), PUT a la URL firmada y POST /api/v1/uploads/complete",
      410
    )
  );
}
