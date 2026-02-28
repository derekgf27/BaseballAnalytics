import { redirect } from "next/navigation";

/**
 * Today moved to /coach. Redirect old /coach/today links.
 */
export default function CoachTodayRedirect() {
  redirect("/coach");
}
