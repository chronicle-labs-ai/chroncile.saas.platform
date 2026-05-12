import { redirect } from "next/navigation";

/*
 * /dashboard/signals
 *
 * Signals is a sidebar group (`Connections`, `Timeline`), not a
 * route in its own right. The sidebar shell renders the parent as
 * a clickable link; we redirect direct visits to the canonical
 * sub-route (Timeline) so the URL works as a bookmark and clicking
 * the parent in the sidebar feels continuous instead of 404'ing.
 *
 * Mirror of `/dashboard/validation` for the Validation group.
 */
export default function SignalsLandingPage(): never {
  redirect("/dashboard/timeline");
}
