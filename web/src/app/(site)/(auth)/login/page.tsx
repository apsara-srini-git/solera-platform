import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getProLang } from "@/lib/i18n/server";
import { AUTH } from "@/lib/i18n/pro/auth";
import AuthForm from "../auth-form";

export async function generateMetadata() {
  return { title: AUTH[await getProLang()].metaLogin };
}

export default async function Page({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const target = typeof next === "string" && next.startsWith("/") ? next : "/projects";
  if (await currentUser()) redirect(target);
  return <AuthForm mode="login" next={target} />;
}
