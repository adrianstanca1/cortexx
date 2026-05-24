import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import DashboardShell from "@/components/DashboardShell";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, MessageSquare, Phone } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

// /contacts/:id — detail + edit for a single contact. Pairs with the
// contacts.getById tRPC procedure added in this commit. Mirrors the
// IssueDetail shape (commit 03f63cd7).

export default function ContactDetail() {
  const [, params] = useRoute("/contacts/:id");
  const [, navigate] = useLocation();
  const contactId = params?.id ? Number(params.id) : NaN;

  const contactQuery = trpc.contacts.getById.useQuery(
    { id: contactId },
    { enabled: Number.isFinite(contactId), retry: false }
  );
  const utils = trpc.useUtils();

  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [projectTag, setProjectTag] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const contact = contactQuery.data;
    if (!contact) return;
    setDisplayName(contact.displayName ?? "");
    setProjectTag(contact.projectTag ?? "");
    setNotes(contact.notes ?? "");
  }, [contactQuery.data]);

  const updateMutation = trpc.contacts.update.useMutation({
    onSuccess: () => {
      toast.success("Contact updated");
      setEditing(false);
      contactQuery.refetch();
      utils.contacts.list.invalidate();
    },
    onError: err => toast.error(err.message ?? "Could not update contact"),
  });

  if (contactQuery.isLoading) {
    return (
      <DashboardShell title="Contact detail">
        <div className="p-8 text-gray-400">Loading…</div>
      </DashboardShell>
    );
  }
  if (contactQuery.isError || !contactQuery.data) {
    return (
      <DashboardShell title="Contact detail">
        <div className="space-y-4 p-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/conversations")}
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <Card>
            <CardContent className="py-12 text-center text-gray-400">
              Contact not found, or you don&apos;t have access.
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  const contact = contactQuery.data;
  const title = contact.displayName || contact.waId || `Contact ${contact.id}`;

  return (
    <DashboardShell title={`Contact: ${title}`}>
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/conversations")}
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to conversations
        </Button>

        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold">{title}</h1>
          {!editing && <Button onClick={() => setEditing(true)}>Edit</Button>}
        </div>

        <Card>
          <CardContent className="space-y-4 p-6">
            {editing ? (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  updateMutation.mutate({
                    id: contact.id,
                    displayName: displayName || undefined,
                    projectTag: projectTag || undefined,
                    notes: notes || undefined,
                  });
                }}
                className="space-y-4"
              >
                <div className="space-y-1">
                  <label className="block text-sm font-medium">
                    Display name
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium">
                    Project tag
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm"
                    value={projectTag}
                    onChange={e => setProjectTag(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium">Notes</label>
                  <textarea
                    className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm"
                    rows={4}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={updateMutation.isPending}>
                    <Save className="mr-1 h-4 w-4" /> Save changes
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {contact.projectTag && (
                    <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                      {contact.projectTag}
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-xs uppercase text-gray-400">
                      WhatsApp ID
                    </div>
                    <div className="mt-1 flex items-center gap-1">
                      <Phone className="h-3 w-3 text-gray-400" />
                      {contact.waId ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-gray-400">
                      Display name
                    </div>
                    <div className="mt-1">{contact.displayName ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-gray-400">
                      Project tag
                    </div>
                    <div className="mt-1">{contact.projectTag ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-gray-400">
                      Last seen
                    </div>
                    <div className="mt-1">
                      {contact.lastSeenAt
                        ? format(new Date(contact.lastSeenAt), "PP p")
                        : "—"}
                    </div>
                  </div>
                </div>
                {contact.notes && (
                  <div>
                    <div className="text-xs uppercase text-gray-400">Notes</div>
                    <p className="mt-1 whitespace-pre-wrap text-gray-200">
                      {contact.notes}
                    </p>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      navigate(`/conversations?contactId=${contact.id}`)
                    }
                  >
                    <MessageSquare className="mr-1 h-4 w-4" /> View
                    conversations
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
