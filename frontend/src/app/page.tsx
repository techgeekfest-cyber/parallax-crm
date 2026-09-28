import { redirect } from "next/navigation";

// Signed-in users land on the dashboard; the proxy sends everyone else to sign-in first.
export default function Home() {
  redirect("/dashboard");
}
