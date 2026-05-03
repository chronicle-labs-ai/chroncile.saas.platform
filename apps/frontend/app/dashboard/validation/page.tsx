import { redirect } from "next/navigation";

/*
 * /dashboard/validation
 *
 * Validation is a sidebar group (`Datasets`, `Agents`,
 * `Backtests / Replay`), not a route in its own right. The
 * dashboard sidebar shell renders the parent as a clickable
 * link — when a user follows it directly we land them on the
 * canonical sub-route (Datasets) so the navigation feels
 * continuous instead of 404'ing.
 *
 * Mirror of `/dashboard/signals` for the Signals group.
 */
export default function ValidationLandingPage(): never {
  redirect("/dashboard/datasets");
}
