import EmailAuth from "@/components/email-auth";
export default async function SignIn({ searchParams }: { searchParams: Promise<{ return_to?: string; error?: string; mode?: string }> }) {
  const params = await searchParams;
  return <EmailAuth returnTo={params.return_to} expired={params.error === "expired"} register={params.mode === "register"}/>;
}
