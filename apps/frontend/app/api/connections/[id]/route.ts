import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { deleteAccount } from "@/lib/pipedream";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { error: "Unauthorized" },
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
        { error: "Connection not found" },
        { status: 404 }
      );
    }

    if (connection.pipedreamAuthId) {
      try {
        console.log(`Deleting Pipedream account ${connection.pipedreamAuthId} for tenant ${session.user.tenantId}`);
        await deleteAccount(connection.pipedreamAuthId);
        console.log(`Successfully deleted Pipedream account ${connection.pipedreamAuthId}`);
      } catch (pipedreamError) {
        console.error("Error deleting Pipedream account:", pipedreamError);
      }
    } else if (connection.accessToken) {
      try {
        console.log(`Disconnecting legacy ${connection.provider} connection for tenant ${session.user.tenantId}`);
      } catch (revokeError) {
        console.error("Error during token cleanup:", revokeError);
      }
    }

    await prisma.connection.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Connection disconnected successfully",
    });
  } catch (error) {
    console.error("Error deleting connection:", error);
    return NextResponse.json(
      { error: "Failed to disconnect" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const connection = await prisma.connection.findFirst({
      where: {
        id,
        tenantId: session.user.tenantId,
      },
      select: {
        id: true,
        provider: true,
        status: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!connection) {
      return NextResponse.json(
        { error: "Connection not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(connection);
  } catch (error) {
    console.error("Error fetching connection:", error);
    return NextResponse.json(
      { error: "Failed to fetch connection" },
      { status: 500 }
    );
  }
}
