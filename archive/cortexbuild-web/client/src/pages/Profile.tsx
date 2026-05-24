import { useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, Mail, Shield, Calendar, Clock } from "lucide-react";
import { toast } from "sonner";

export default function Profile() {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");

  const handleSave = () => {
    toast.success("Profile updated successfully (demo)");
    setIsEditing(false);
  };

  if (!user) {
    return (
      <DashboardShell title="Profile" subtitle="Not authenticated">
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center text-muted-foreground">
            <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Please sign in to view your profile.</p>
          </CardContent>
        </Card>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Profile" subtitle="Manage your account settings">
      <div className="max-w-2xl space-y-6">
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold">
                {user.name?.charAt(0)?.toUpperCase() ?? "U"}
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-foreground">{user.name || "User"}</h2>
                <p className="text-sm text-muted-foreground">{user.email || "No email"}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={user.role === "admin" ? "default" : "secondary"} className="text-xs capitalize">
                    <Shield className="w-3 h-3 mr-1" />
                    {user.role}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <Clock className="w-3 h-3 mr-1" />
                    {user.loginMethod || "OAuth"}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-2">
                <User className="w-3.5 h-3.5" />
                Display Name
              </Label>
              {isEditing ? (
                <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-input border-border" />
              ) : (
                <p className="text-sm text-foreground">{user.name || "—"}</p>
              )}
            </div>
            <Separator className="bg-border" />
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-2">
                <Mail className="w-3.5 h-3.5" />
                Email Address
              </Label>
              {isEditing ? (
                <Input value={email} onChange={(e) => setEmail(e.target.value)} className="bg-input border-border" />
              ) : (
                <p className="text-sm text-foreground">{user.email || "—"}</p>
              )}
            </div>
            <Separator className="bg-border" />
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-2">
                <Shield className="w-3.5 h-3.5" />
                Role
              </Label>
              <p className="text-sm text-foreground capitalize">{user.role}</p>
            </div>
            <Separator className="bg-border" />
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" />
                Member Since
              </Label>
              <p className="text-sm text-foreground">
                {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              {isEditing ? (
                <>
                  <Button onClick={handleSave}>Save Changes</Button>
                  <Button variant="outline" className="border-border" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button variant="outline" className="border-border" onClick={() => setIsEditing(true)}>
                  Edit Profile
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
