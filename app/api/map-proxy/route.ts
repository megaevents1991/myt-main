import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTNAME = "tixstock.s3.eu-west-2.amazonaws.com";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json(
      { error: "Missing url parameter" },
      { status: 400 },
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json(
      { error: "Invalid url parameter" },
      { status: 400 },
    );
  }

  if (parsed.hostname !== ALLOWED_HOSTNAME) {
    return NextResponse.json({ error: "URL not allowed" }, { status: 403 });
  }

  const response = await fetch(url);

  if (!response.ok) {
    return NextResponse.json(
      { error: "Failed to fetch resource" },
      { status: response.status },
    );
  }

  const contentType = response.headers.get("content-type") ?? "image/svg+xml";
  const body = await response.arrayBuffer();

  return new NextResponse(body, {
    status: 200,
    headers: { "content-type": contentType },
  });
}
