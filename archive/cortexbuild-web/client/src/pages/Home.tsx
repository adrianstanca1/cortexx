import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  HardHat,
  MessageSquare,
  Brain,
  AlertTriangle,
  Image,
  FileText,
  Wifi,
  ArrowRight,
  CheckCircle,
} from "lucide-react";

const FEATURES = [
  { icon: MessageSquare, title: "WhatsApp Integration", desc: "Receive and respond to messages via WhatsApp Business Cloud API" },
  { icon: Brain, title: "Persistent Memory", desc: "AI remembers every conversation, decision, and project update" },
  { icon: Image, title: "Vision AI Analysis", desc: "Automatically analyze site photos for issues and safety hazards" },
  { icon: AlertTriangle, title: "Issue Tracking", desc: "Auto-detect and log construction issues from chat and images" },
  { icon: FileText, title: "Report Generation", desc: "Generate PDF and HTML reports from chat history and issues" },
  { icon: Wifi, title: "Real-time Agent", desc: "24/7 AI assistant that responds instantly on WhatsApp" },
];

export default function Home() {
  const { isAuthenticated, loading } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <HardHat className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-foreground">CortexBuild AI</span>
        </div>
        {!loading && (
          isAuthenticated ? (
            <Button asChild>
              <Link href="/dashboard">
                Open Dashboard <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          ) : (
            <Button asChild>
              <a href={getLoginUrl()}>Sign In</a>
            </Button>
          )
        )}
      </nav>

      {/* Hero */}
      <section className="px-6 py-20 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-6">
          <Wifi className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs text-primary font-medium">WhatsApp-Connected AI Agent</span>
        </div>
        <h1 className="text-5xl font-extrabold text-foreground leading-tight mb-4">
          Construction Site Intelligence<br />
          <span className="text-primary">on WhatsApp</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
          An AI-powered personal assistant that monitors your construction site via WhatsApp — tracking issues, analyzing photos, remembering every conversation, and generating reports automatically.
        </p>
        <div className="flex items-center justify-center gap-4">
          {isAuthenticated ? (
            <Button size="lg" asChild>
              <Link href="/dashboard">
                Open Dashboard <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          ) : (
            <Button size="lg" asChild>
              <a href={getLoginUrl()}>
                Get Started <ArrowRight className="w-4 h-4 ml-2" />
              </a>
            </Button>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-center text-foreground mb-10">Everything you need in one platform</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="bg-card border border-border rounded-xl p-5 hover:border-primary/40 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <Icon className="w-4.5 h-4.5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-16 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-center text-foreground mb-10">How it works</h2>
        <div className="space-y-4">
          {[
            "Connect your WhatsApp Business number via Meta Cloud API",
            "Workers send messages and photos from the construction site",
            "AI analyzes every image and message in real-time",
            "Issues are automatically detected, logged, and tracked",
            "Daily and weekly reports are sent back to WhatsApp or email",
            "Admin dashboard gives you full visibility and control",
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-bold text-primary">{i + 1}</span>
              </div>
              <p className="text-sm text-muted-foreground">{step}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted-foreground">
        CortexBuild AI — Construction Site Intelligence Platform
      </footer>
    </div>
  );
}
