import { ShieldCheck, FileText, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeroProps {
  onScrollToVerify: () => void;
}

export const Hero = ({ onScrollToVerify }: HeroProps) => {
  return (
    <section className="relative bg-gradient-hero py-20 px-4 overflow-hidden">
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      
      <div className="container mx-auto max-w-6xl relative z-10">
        <div className="text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-primary">AI-Powered Verification</span>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold text-foreground leading-tight">
            Detect Fake News &<br />
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              Deepfake Images
            </span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Advanced AI technology to verify the authenticity of news articles and images. 
            Combat misinformation with real-time detection and analysis.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            <Button 
              size="lg" 
              className="bg-gradient-primary hover:opacity-90 transition-opacity shadow-lg"
              onClick={onScrollToVerify}
            >
              Start Verification
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="border-2 border-primary/20 hover:bg-primary/5"
            >
              Learn More
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-12 max-w-3xl mx-auto">
            <div className="flex items-start gap-4 p-6 rounded-xl bg-card shadow-md border border-border">
              <div className="p-3 rounded-lg bg-primary/10">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-lg mb-1">Text Analysis</h3>
                <p className="text-sm text-muted-foreground">
                  Detect fake news using advanced NLP models
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-4 p-6 rounded-xl bg-card shadow-md border border-border">
              <div className="p-3 rounded-lg bg-secondary/10">
                <ImageIcon className="w-6 h-6 text-secondary" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-lg mb-1">Image Verification</h3>
                <p className="text-sm text-muted-foreground">
                  Identify deepfakes and manipulated images
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
