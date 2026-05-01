import { workos } from "./workos";

export const OWNER_METADATA_KEY = "owner_user_id";
export const ADMIN_ROLE_SLUG = "admin";

export async function getOwnerUserId(
  organizationId: string,
): Promise<string | null> {
  const org = await workos.organizations.getOrganization(organizationId);
  const owner = org.metadata?.[OWNER_METADATA_KEY];
  return typeof owner === "string" && owner.length > 0 ? owner : null;
}

export async function listActiveAdmins(
  organizationId: string,
): Promise<Array<{ id: string; userId: string }>> {
  const list = await workos.userManagement.listOrganizationMemberships({
    organizationId,
    statuses: ["active"],
  });
  return list.data
    .filter((m) => m.role?.slug === ADMIN_ROLE_SLUG)
    .map((m) => ({ id: m.id, userId: m.userId }));
}

export async function setOwnerUserId(
  organizationId: string,
  ownerUserId: string,
): Promise<void> {
  const org = await workos.organizations.getOrganization(organizationId);
  await workos.organizations.updateOrganization({
    organization: organizationId,
    metadata: {
      ...org.metadata,
      [OWNER_METADATA_KEY]: ownerUserId,
    },
  });
}
