import { redirect } from "next/navigation";
import { getOptionalAdmin } from "@/lib/auth/get-session";

export default async function HomePage() {
  const admin = await getOptionalAdmin();

  if (admin) {
    redirect("/dashboard");
  }

  redirect("/sign-in");
}
