import DashboardShell from "@/components/DashboardShell";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Settings as SettingsIcon, Wifi, Copy, CheckCircle, Info } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const { data: config } = trpc.settings.getAll.useQuery();
  const setConfig = trpc.settings.set.useMutation({
    onSuccess: () => toast.success("Setting saved"),
    onError: () => toast.error("Failed to save setting"),
  });

  const [webhookCopied, setWebhookCopied] = useState(false);

  const webhookUrl = `${window.location.origin}/api/webhook/whatsapp`;

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setWebhookCopied(true);
    setTimeout(() => setWebhookCopied(false), 2000);
  };

  // config is a Record<string, string> from the server

  return (
    <DashboardShell title="Settings" subtitle="Configure WhatsApp integration and agent behavior">
      <div className="space-y-6 max-w-2xl">

        {/* WhatsApp Setup Guide */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Wifi className="w-4 h-4 text-green-400" />
              WhatsApp Business API Setup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex gap-2">
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-300 space-y-1">
                <p className="font-medium">Setup Steps:</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-300/80">
                  <li>Go to <strong>developers.facebook.com</strong> → Create App → WhatsApp</li>
                  <li>Get your <strong>Access Token</strong> and <strong>Phone Number ID</strong></li>
                  <li>In Webhooks, paste the URL below and set verify token to <code className="bg-blue-500/20 px-1 rounded">cortexbuild_verify_token</code></li>
                  <li>Subscribe to <strong>messages</strong> webhook field</li>
                  <li>Add your credentials to the VPS <code className="bg-blue-500/20 px-1 rounded">.env</code> file</li>
                </ol>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Your Webhook URL</Label>
              <div className="flex gap-2">
                <Input
                  value={webhookUrl}
                  readOnly
                  className="bg-input border-border text-foreground font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border text-foreground hover:bg-muted shrink-0"
                  onClick={copyWebhook}
                >
                  {webhookCopied ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Verify Token</Label>
              <Input
                value="cortexbuild_verify_token"
                readOnly
                className="bg-input border-border text-foreground font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">Use this exact value in the Meta webhook verification field</p>
            </div>
          </CardContent>
        </Card>

        {/* Environment Variables Reference */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <SettingsIcon className="w-4 h-4 text-primary" />
              Required Environment Variables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Set these in your VPS <code className="bg-muted px-1 rounded">.env</code> file or Docker environment:
            </p>
            <div className="space-y-2">
              {[
                { key: "WHATSAPP_ACCESS_TOKEN", desc: "Meta WhatsApp Business API access token", required: true },
                { key: "WHATSAPP_PHONE_NUMBER_ID", desc: "WhatsApp phone number ID from Meta dashboard", required: true },
                { key: "WHATSAPP_WEBHOOK_VERIFY_TOKEN", desc: "Webhook verify token (default: cortexbuild_verify_token)", required: false },
                { key: "DATABASE_URL", desc: "MySQL/TiDB connection string", required: true },
                { key: "JWT_SECRET", desc: "Session signing secret", required: true },
              ].map((env) => (
                <div key={env.key} className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/50 border border-border">
                  <code className="text-xs text-primary font-mono shrink-0">{env.key}</code>
                  <p className="text-xs text-muted-foreground flex-1">{env.desc}</p>
                  <Badge variant="outline" className={`text-xs shrink-0 ${env.required ? "text-orange-400 border-orange-400/30" : "text-muted-foreground border-border"}`}>
                    {env.required ? "required" : "optional"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Agent Config */}
        {config && Object.keys(config).length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-foreground">Agent Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(config).map(([key, value]) => ({ key, value, description: null })).map((item) => (
                <div key={item.key} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{item.key}</Label>
                  {item.description && <p className="text-xs text-muted-foreground/70">{item.description}</p>}
                  <Input
                    defaultValue={item.value}
                    className="bg-input border-border text-foreground"
                    onBlur={(e) => {
                      if (e.target.value !== item.value) {
                        setConfig.mutate({ key: item.key, value: e.target.value });
                      }
                    }}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}
