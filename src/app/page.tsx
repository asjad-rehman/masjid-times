import { getJamaatTimes } from "@/lib/db";
import HomeClient from "@/app/HomeClient";

export const revalidate = 0;

export default async function Home() {
  const jamaat = await getJamaatTimes();

  return <HomeClient initialJamaat={jamaat} />;
}
