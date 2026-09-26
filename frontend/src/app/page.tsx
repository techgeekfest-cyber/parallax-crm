import { redirect } from "next/navigation";

// The dashboard arrives in phase A4; until then the app opens on Leads.
export default function Home() {
  redirect("/leads");
}
