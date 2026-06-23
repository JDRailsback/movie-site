import { Navbar } from "@/components/layout/Navbar";

export default async function ProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ profile: string }>;
}) {
  const { profile } = await params;
  return (
    <>
      <Navbar profileId={profile} />
      {children}
    </>
  );
}
