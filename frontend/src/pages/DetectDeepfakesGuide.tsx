import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { AppHeader } from "@/components/AppHeader";
import { BackToTop } from "@/components/BackToTop";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import {
  ShieldCheck,
  Image as ImageIcon,
  Video as VideoIcon,
  Mic,
  FileText,
  Link2,
  Eye,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";


const SITE = typeof window !== "undefined" ? window.location.origin : "https://veri-truth-guardian.com";
const PATH = "/guides/how-to-detect-deepfakes";

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "How to Detect Deepfakes: A Forensic AI Analysis Guide",
  description:
    "A practical guide to detecting deepfakes and manipulated media using forensic AI analysis — covering EXIF data, lighting inconsistencies, AI artifacts, voice cloning cues and video temporal glitches.",
  author: { "@type": "Organization", name: "VeriFact" },
  publisher: { "@type": "Organization", name: "VeriFact" },
  mainEntityOfPage: `${SITE}${PATH}`,
  datePublished: "2026-07-06",
  dateModified: "2026-07-06",
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How can I tell if an image is a deepfake?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Check for asymmetric lighting, mismatched shadows, warped ears or teeth, blurry background transitions, and missing or altered EXIF metadata. Forensic AI models add pixel-level analysis that spots GAN and diffusion fingerprints humans can't see.",
      },
    },
    {
      "@type": "Question",
      name: "What is forensic AI analysis?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Forensic AI analysis uses machine-learning classifiers (CNNs, transformers, spectrogram models) plus signal-processing techniques to score how likely a piece of media is real, AI-generated, or edited — usually with a confidence percentage and localized artifact map.",
      },
    },
    {
      "@type": "Question",
      name: "Can deepfake audio be detected?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — voice-cloning and synthetic speech leave spectral artifacts, unnatural prosody, and inconsistent speaker embeddings. VeriFact's Audio module uses an ensemble of Whisper, Wav2Vec 2.0 and ECAPA-TDNN to flag cloned or spliced voices.",
      },
    },
  ],
};

const Step = ({
  n,
  icon: Icon,
  title,
  children,
}: {
  n: number;
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) => (
  <Card className="glass-panel p-6 animate-lift">
    <div className="flex items-start gap-4">
      <div className="bg-gradient-primary p-3 rounded-xl shrink-0">
        <Icon className="h-5 w-5 text-primary-foreground" />
      </div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Step {n}
        </div>
        <h2 className="text-xl font-semibold mb-2">{title}</h2>
        <div className="text-muted-foreground space-y-2 leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  </Card>
);

const DetectDeepfakesGuide = () => {
  return (
    <div className="min-h-screen bg-gradient-hero">
      <Seo
        title="How to Detect Deepfakes — Forensic AI Analysis Guide | VeriFact"
        description="Learn how to detect deepfakes with forensic AI analysis. Spot EXIF anomalies, lighting inconsistencies, AI artifacts, voice cloning and video manipulation in 6 practical steps."
        path={PATH}
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(articleSchema)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(faqSchema)}
        </script>
      </Helmet>

      <AppHeader />

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <span className="mx-2">/</span>
          <span>Guides</span>
          <span className="mx-2">/</span>
          <span className="text-foreground">How to detect deepfakes</span>
        </nav>

        <header className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-primary uppercase tracking-wider">
              Forensic AI Analysis Guide
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4">
            How to Detect Deepfakes
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A practical, forensic AI-driven walkthrough for spotting manipulated
            images, cloned voices and synthetic video — using the same signals
            VeriFact scores in production.
          </p>
        </header>

        <Card className="glass-panel p-6 mb-10">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> What you'll learn
          </h2>
          <ul className="grid md:grid-cols-2 gap-2 text-sm text-muted-foreground list-disc pl-5">
            <li>Reading EXIF metadata and provenance signals</li>
            <li>Spotting lighting, shadow and geometry inconsistencies</li>
            <li>Recognising GAN and diffusion image artifacts</li>
            <li>Catching temporal glitches in deepfake video</li>
            <li>Identifying cloned or synthetic voices</li>
            <li>Cross-checking claims and sources for fake news</li>
          </ul>
        </Card>

        <section className="space-y-6">
          <Step n={1} icon={FileText} title="Inspect EXIF and provenance metadata">
            <p>
              Real photos carry EXIF: camera make and model, focal length, GPS,
              creation date and colour profile. Deepfakes and AI-generated images
              usually strip EXIF entirely, or leave residual tags like
              <code className="mx-1 px-1.5 py-0.5 rounded bg-muted text-foreground text-xs">Software: Stable Diffusion</code>
              or Midjourney watermarks.
            </p>
            <p>
              VeriFact's <strong>Image module</strong> parses EXIF client-side with
              exifr and flags missing camera fingerprints, edited timestamps and
              known-AI software tags before it even runs the model.
            </p>
          </Step>

          <Step n={2} icon={Eye} title="Check lighting, shadows and geometry">
            <p>
              Diffusion models still struggle with global light coherence. Look
              for shadows cast in inconsistent directions, catchlights that
              disagree between eyes, missing shadows under jewellery or glasses,
              and warped ear cartilage, teeth or fingers.
            </p>
            <p>
              These are the same cues MIT's Detect Fakes project trains people
              on — VeriFact's forensic model turns them into a numeric
              probability so you don't have to eyeball it.
            </p>
          </Step>

          <Step n={3} icon={ImageIcon} title="Look for AI artifacts at pixel level">
            <p>
              GAN and diffusion outputs leave statistical fingerprints:
              periodic frequency-domain patterns, over-smoothed skin,
              hallucinated text, and characteristic noise residuals different
              from real sensor noise.
            </p>
            <p>
              Upload the image to VeriFact — the Image module returns
              <em> synthetic likelihood</em>, <em>manipulation score</em> and a
              localized heat-map of suspect regions.
            </p>
          </Step>

          <Step n={4} icon={VideoIcon} title="Analyse video for temporal glitches">
            <p>
              Deepfake video is hardest to keep consistent frame-to-frame. Watch
              for flickering face edges, mismatched blink rates, teeth that
              change shape between frames, and lip-sync drift against the audio.
            </p>
            <p>
              VeriFact's <strong>Video module</strong> samples frames, runs
              per-frame deepfake scoring, and combines it with an audio pass so
              you get a single verdict for the clip.
            </p>
          </Step>

          <Step n={5} icon={Mic} title="Detect voice cloning and synthetic speech">
            <p>
              Cloned and TTS voices leak in the spectrogram: over-regular pitch
              contours, missing micro-jitter, unnatural breath placement and
              splice discontinuities where segments were stitched together.
            </p>
            <p>
              The <strong>Audio module</strong> uses an ensemble (Whisper +
              Wav2Vec 2.0 + ECAPA-TDNN + spectrogram CNN) to classify a clip as
              real, AI-generated, voice-cloned, edited or spliced, with a
              timeline of tampering events.
            </p>
          </Step>

          <Step n={6} icon={Link2} title="Cross-check the story, not just the media">
            <p>
              A convincing deepfake usually travels with a fake narrative. Run
              the source URL through VeriFact's <strong>URL module</strong> — it
              scores domain age, SSL trust, Google Safe Browsing status, and
              content credibility. Combined with the <strong>Text module</strong>,
              it flags sensational language, bias, unsupported claims and
              contradictions inside the article itself.
            </p>
          </Step>
        </section>

        <Card className="glass-panel p-6 mt-10 border-warning/40">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <h2 className="font-semibold mb-1">A note on false positives</h2>
              <p className="text-sm text-muted-foreground">
                No detector is 100% accurate. Treat forensic AI scores as
                evidence, not verdicts — combine at least two modules (e.g.
                image + URL, or audio + text) and check the source before
                sharing conclusions publicly.
              </p>
            </div>
          </div>
        </Card>

        <section className="mt-12 text-center">
          <h2 className="text-2xl font-bold mb-3">Try it on your own media</h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Run any image, video, audio clip, article or URL through VeriFact's
            forensic AI pipeline in seconds.
          </p>
          <Button asChild size="lg" className="bg-gradient-primary">
            <Link to="/">
              Start verification <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </section>
      </main>
      <BackToTop />
    </div>
  );
};

export default DetectDeepfakesGuide;
