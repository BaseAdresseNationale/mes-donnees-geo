import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { isValidInseeCode } from "@/lib/geo/commune";
import { HomePageContent } from "@/components/home/HomePageContent";

export default async function HomePage() {
  const session = await getSession();

  if (session && isValidInseeCode(session.communeInsee ?? "")) {
    redirect(`/${session.communeInsee}`);
  }

  return <HomePageContent />;
}
