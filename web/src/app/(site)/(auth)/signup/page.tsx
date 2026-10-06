import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getProLang } from "@/lib/i18n/server";
import { AUTH } from "@/lib/i18n/pro/auth";
import AuthForm from "../auth-form";

export async function generateMetadata() {
  return { title: AUTH[await getProLang()].metaSignup };
}

export default async function Page({ searchParams }: PageProps<"/signup">) {
  const { next } = await searchParams;
  const target = typeof next === "string" && next.startsWith("/") ? next : "/projects";
  if (await currentUser()) redirect(target);
  return <AuthForm mode="signup" next={target} />;
}
