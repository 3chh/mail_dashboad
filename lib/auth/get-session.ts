import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/auth-options";
import { resolveAdminFromSessionUser } from "@/lib/auth/admin";

export async function getRequiredSession() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  return session;
}

export async function getOptionalSession() {
  return getServerSession(authOptions);
}

export async function getRequiredAdmin() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/sign-in");
  }

  const admin = await resolveAdminFromSessionUser(session.user);

  if (!admin) {
    redirect("/sign-in");
  }

  return admin;
}

export async function getOptionalAdmin() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  return resolveAdminFromSessionUser(session.user);
}
