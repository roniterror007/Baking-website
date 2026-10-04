import EmailAuth from "@/components/email-auth";
export default async function SignOut({ searchParams }: { searchParams: Promise<{ return_to?: string }> }) {
  return <EmailAuth signOut returnTo={(await searchParams).return_to}/>;
}
