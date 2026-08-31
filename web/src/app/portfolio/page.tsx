import type { Metadata } from "next";
import { PortfolioHeading, PortfolioView } from "@/components/portfolio/portfolio-view";

export const metadata: Metadata = {
  title: "Your contributions",
  description:
    "What this wallet has contributed, what reached a school, and anything available to withdraw.",
};

export default function PortfolioPage() {
  return (
    <div className="container-page py-8 sm:py-12">
      <PortfolioHeading />
      <div className="mt-9">
        <PortfolioView />
      </div>
    </div>
  );
}
