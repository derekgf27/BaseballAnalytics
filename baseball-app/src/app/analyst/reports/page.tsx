import { redirect } from "next/navigation";

/** Reports hub lives at `/reports` (shared layout with Analyst nav). */
export default function AnalystReportsRedirectPage() {
  redirect("/reports");
}
