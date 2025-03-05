import { Log } from "@/lib/app.types";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { type = "log", data }: Log = await request.json();

  console[type](data);

  return NextResponse.json({});
}
