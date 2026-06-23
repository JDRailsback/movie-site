import { redirect } from "next/navigation";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ profile: string }>;
}) {
  const { profile } = await params;
  redirect(`/p/${profile}/recs`);
}
