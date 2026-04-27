import type {
  FeatureAccessResponse,
  FeatureAccessSnapshot,
} from "shared/generated";
import { fetchFromBackend } from "@/server/backend/fetch-from-backend";

export async function fetchFeatureAccess(): Promise<FeatureAccessSnapshot | null> {
  try {
    const response = await fetchFromBackend<FeatureAccessResponse>(
      "/api/platform/feature-access"
    );
    return response.access;
  } catch {
    return null;
  }
}
