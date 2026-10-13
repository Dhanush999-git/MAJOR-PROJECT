import { useState } from "react";
import { ModeSelector } from "@/components/ModeSelector";
import { VerificationSection } from "@/components/VerificationSection";
import { AppHeader } from "@/components/AppHeader";
import { AppFooter } from "@/components/AppFooter";
import { BackToTop } from "@/components/BackToTop";
import { FloatingModeControl } from "@/components/FloatingModeControl";
import { Seo } from "@/components/Seo";
import { useAnalysis, type AnalysisMode } from "@/contexts/AnalysisContext";

const Index = () => {
  const [selectedMode, setSelectedMode] = useState<AnalysisMode | null>(null);
  const { activeModule, setActiveModule } = useAnalysis();

  const handleSelectMode = (mode: AnalysisMode) => {
    setSelectedMode(mode);
    setActiveModule(mode);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-hero selection:bg-primary/20 selection:text-primary">
      <Seo
        title="VeriFact — AI Fake News & Deepfake Detection"
        description="Verify text, images, video, audio and URLs with forensic AI. Detect fake news, deepfakes and manipulated media in seconds."
        path="/"
      />
      <AppHeader />
      <main className="flex-1">
        {!selectedMode ? (
          <ModeSelector onSelectMode={handleSelectMode} />
        ) : (
          <div className="container mx-auto px-2 sm:px-4 py-6 sm:py-8">
            <FloatingModeControl
              currentMode={activeModule}
              onBack={() => setSelectedMode(null)}
              onSelectMode={(m) => setActiveModule(m)}
            />
            <VerificationSection initialMode={selectedMode} />
          </div>
        )}
      </main>
      <AppFooter />
      <BackToTop />
    </div>
  );
};

export default Index;
