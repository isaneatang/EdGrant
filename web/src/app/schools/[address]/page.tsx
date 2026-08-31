import type { Metadata } from "next";
import { SchoolProfilePage } from "@/components/schools/school-profile-page";

export const metadata: Metadata = {
  title: "Institution",
  description:
    "A verified institution's page: what has been verified, what it has actually been paid, and, kept clearly separate, what it says about itself.",
};

export default async function SchoolPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  return <SchoolProfilePage addressParam={address} />;
}
