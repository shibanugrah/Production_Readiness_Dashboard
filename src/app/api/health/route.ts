import { NextResponse } from "next/server";

import { buildHealthResponse } from "@/server/health";

export async function GET() {
  const response = await buildHealthResponse();

  return NextResponse.json(response.body, {
    status: response.httpStatus,
  });
}
