import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "platform-api";

const BACKEND_URL = getBackendUrl();

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const res = await fetch(`${BACKEND_URL}/api/platform/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: body.email,
        password: body.password,
        name: body.name,
        orgName: body.organizationName,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.error || "Signup failed" },
        { status: res.status }
      );
    }

    return NextResponse.json(
      {
        message: "Account created successfully",
        user: data.user,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "An error occurred during signup. Please try again." },
      { status: 500 }
    );
  }
}
