'use client';

import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import FeaturesSection from "@/components/FeaturesSection";
import FooterCTA from "@/components/Footer";
import HowItWorksSection from "@/components/HowItWorks";
import DemoPreviewSection from "@/components/DemoPreviewSection";
import StatsSection from "@/components/StatsSection";
import ProblemSection from "@/components/ProblemsSesction";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <ProblemSection />
      <FeaturesSection />
      <HowItWorksSection />
      <DemoPreviewSection />
      <StatsSection />
      <FooterCTA />
    </div>
  );
}
