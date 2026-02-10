import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { getAccount } from "@/lib/pipedream";

export const dynamic = "force-dynamic";

interface HealthCheckResult {
  healthy: boolean;
  status: "connected" | "error" | "expired" | "unknown";
  message: string;
  details?: {
    workspace_name?: string;
    admin_email?: string;
    region?: string;
    app_name?: string;
    last_checked?: string;
  };
  error?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<HealthCheckResult>> {
  try {
    const session = await auth();

    if (!session?.user?.tenantId) {
      return NextResponse.json(
        {
          healthy: false,
          status: "error",
          message: "Unauthorized",
          error: "Not authenticated",
        },
        { status: 401 }
      );
    }

    const { id } = await params;

    const connection = await prisma.connection.findFirst({
      where: {
        id,
        tenantId: session.user.tenantId,
      },
    });

    if (!connection) {
      return NextResponse.json(
        {
          healthy: false,
          status: "error",
          message: "Connection not found",
          error: "Connection not found or access denied",
        },
        { status: 404 }
      );
    }

    if (connection.pipedreamAuthId) {
      return await testPipedreamConnection(connection);
    }

    return NextResponse.json({
      healthy: connection.status === "active",
      status: connection.status === "active" ? "connected" : "unknown",
      message: `Connection status: ${connection.status}`,
      details: {
        last_checked: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error testing connection:", error);
    return NextResponse.json(
      {
        healthy: false,
        status: "error",
        message: "Failed to test connection",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

async function testPipedreamConnection(connection: {
  id: string;
  pipedreamAuthId: string | null;
  provider: string;
  status: string;
  metadata: unknown;
}): Promise<NextResponse<HealthCheckResult>> {
  try {
    if (!connection.pipedreamAuthId) {
      return NextResponse.json({
        healthy: false,
        status: "error",
        message: "No Pipedream account ID found",
        error: "Connection is missing pipedreamAuthId",
        details: {
          last_checked: new Date().toISOString(),
        },
      });
    }

    const { data: account } = await getAccount(connection.pipedreamAuthId);

    if (account.dead) {
      return NextResponse.json({
        healthy: false,
        status: "expired",
        message: "Connection is no longer valid",
        error: "The connection has been revoked or expired. Please reconnect.",
        details: {
          app_name: account.app?.name,
          last_checked: new Date().toISOString(),
        },
      });
    }

    if (!account.healthy) {
      return NextResponse.json({
        healthy: false,
        status: "error",
        message: "Connection is unhealthy",
        error: "The connection may need to be re-authenticated.",
        details: {
          app_name: account.app?.name,
          last_checked: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json({
      healthy: true,
      status: "connected",
      message: "Connection is healthy",
      details: {
        workspace_name: account.name,
        app_name: account.app?.name,
        last_checked: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error testing Pipedream connection:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    if (errorMessage.includes("404") || errorMessage.includes("not found")) {
      return NextResponse.json({
        healthy: false,
        status: "expired",
        message: "Connection not found in Pipedream",
        error: "The connection may have been deleted. Please reconnect.",
        details: {
          last_checked: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json({
      healthy: false,
      status: "error",
      message: "Failed to test connection",
      error: errorMessage,
      details: {
        last_checked: new Date().toISOString(),
      },
    });
  }
}
