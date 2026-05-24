/**
 * ChatInbox — Real in-app chat interface
 *
 * Lets you create contacts and send messages + images directly from the dashboard.
 * Every message goes through the full AI pipeline:
 *   - Text → issue detection + memory extraction + AI reply
 *   - Image → S3 upload → vision AI analysis → issue detection + AI reply
 *
 * All data lands in the same DB as WhatsApp messages.
 * When WhatsApp is connected, real messages appear here automatically.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useSseMessages } from "@/hooks/useSseMessages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import DashboardShell from "@/components/DashboardShell";
import {
  MessageSquare, Send, Image, Plus, Bot, User, Loader2,
  AlertTriangle, Brain, Eye, X, Paperclip, CheckCircle,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import type { Contact, Conversation } from "../../../drizzle/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UploadedFile {
  url: string;
  s3Key: string;
  mimeType: string;
  localPreview: string;
  name: string;
}

// ─── Contact List Panel ───────────────────────────────────────────────────────

function ContactPanel({
  contacts,
  selected,
  onSelect,
  onNewContact,
  isLoading,
}: {
  contacts: Contact[];
  selected: Contact | null;
  onSelect: (c: Contact) => void;
  onNewContact: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="flex flex-col h-full border-r border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Contacts</h2>
        <Button
          size="sm"
          variant="outline"
          className="border-primary/30 text-primary hover:bg-primary/10 h-7 px-2"
          onClick={onNewContact}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          New
        </Button>
      </div>

      {/* Contact list */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <MessageSquare className="w-8 h-8 text-muted-foreground mb-3" />
            <p className="text-xs text-muted-foreground">No contacts yet. Create one to start chatting.</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {contacts.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelect(c)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  selected?.id === c.id
                    ? "bg-primary/10 border border-primary/20"
                    : "hover:bg-muted border border-transparent"
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">
                    {(c.displayName ?? c.phoneNumber).charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {c.displayName ?? c.phoneNumber}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{c.phoneNumber}</p>
                </div>
                {c.projectTag && (
                  <Badge variant="outline" className="text-xs text-primary border-primary/30 shrink-0">
                    {c.projectTag}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: any }) {
  const isInbound = msg.direction === "inbound";
  const isAI = !isInbound;

  return (
    <div className={`flex gap-2.5 ${isAI ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1 ${
        isAI ? "bg-primary/10 border border-primary/20" : "bg-muted border border-border"
      }`}>
        {isAI ? <Bot className="w-3.5 h-3.5 text-primary" /> : <User className="w-3.5 h-3.5 text-muted-foreground" />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[72%] flex flex-col gap-1 ${isAI ? "items-end" : "items-start"}`}>
        <div className={`rounded-2xl px-4 py-2.5 text-sm ${
          isAI
            ? "bg-primary/10 border border-primary/20 text-foreground rounded-tr-sm"
            : "bg-card border border-border text-foreground rounded-tl-sm"
        }`}>
          {msg.messageType === "image" ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Image className="w-4 h-4" />
              <span className="italic">{msg.body ?? "Image sent"}</span>
            </div>
          ) : (
            <p className="whitespace-pre-wrap leading-relaxed">{msg.body}</p>
          )}
        </div>

        <div className={`flex items-center gap-2 px-1 ${isAI ? "flex-row-reverse" : ""}`}>
          <span className="text-xs text-muted-foreground">
            {format(new Date(msg.sentAt), "HH:mm")}
          </span>
          {msg.isKeySection && (
            <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-400/30">
              🔑 {msg.keyLabel ?? "Key section"}
            </Badge>
          )}
          {isAI && (
            <span className="text-xs text-primary/60 flex items-center gap-1">
              <Bot className="w-2.5 h-2.5" /> AI
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Conversation Panel ───────────────────────────────────────────────────────

function ConversationPanel({ contact }: { contact: Contact }) {
  const utils = trpc.useUtils();
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState("");
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [lastResult, setLastResult] = useState<{
    issuesDetected: number;
    memoryExtracted: boolean;
    visionTriggered: boolean;
  } | null>(null);

  // Load conversation for this contact
  const { data: conversations } = trpc.conversations.list.useQuery({ limit: 200 });
  const conversation = conversations?.find((c) => c.contactId === contact.id);

  const { data: messages } = trpc.conversations.messages.useQuery(
    { conversationId: conversation?.id ?? 0, limit: 200 },
    { enabled: !!conversation?.id }
  );

  // Real-time SSE messages
  const { liveMessages, isConnected, error: sseError } = useSseMessages(conversation?.id);

  const sendMessage = trpc.inbox.sendMessage.useMutation({
    onSuccess: async (result) => {
      setLastResult({
        issuesDetected: result.issuesDetected,
        memoryExtracted: result.memoryExtracted,
        visionTriggered: result.visionTriggered,
      });
      setText("");
      setUploadedFile(null);
      setIsSending(false);
      await utils.conversations.list.invalidate();
    },
    onError: (err) => {
      toast.error(`Failed to send: ${err.message}`);
      setIsSending(false);
    },
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, liveMessages]);

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/") && file.type !== "application/pdf") {
      toast.error("Only images, videos, and PDFs are supported");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File must be under 20 MB");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");

      const data = await res.json();
      const localPreview = URL.createObjectURL(file);

      setUploadedFile({
        url: data.url,
        s3Key: data.s3Key,
        mimeType: data.mimeType,
        localPreview,
        name: file.name,
      });
      toast.success("File uploaded — ready to send");
    } catch {
      toast.error("Upload failed. Check your S3 configuration.");
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleSend = useCallback(async () => {
    if (!text.trim() && !uploadedFile) return;
    setIsSending(true);
    setLastResult(null);

    sendMessage.mutate({
      contactIdentifier: contact.waId,
      contactName: contact.displayName ?? contact.phoneNumber,
      text: text.trim() || undefined,
      imageUrl: uploadedFile?.url,
      imageS3Key: uploadedFile?.s3Key,
      imageMimeType: uploadedFile?.mimeType,
      projectTag: contact.projectTag ?? undefined,
    });
  }, [text, uploadedFile, contact, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Merge TRPC initial load + SSE live messages, deduplicate by id
  const allMessages = [...(messages ?? []), ...liveMessages];
  const uniqueMessages = Array.from(
    new Map(allMessages.map((m) => [m.id, m])).values()
  );
  const sortedMessages = uniqueMessages.sort(
    (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
  );

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
        <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
          <span className="text-sm font-bold text-primary">
            {(contact.displayName ?? contact.phoneNumber).charAt(0).toUpperCase()}
          </span>
        </div>
        <div>
          <p className="font-semibold text-foreground text-sm">{contact.displayName ?? contact.phoneNumber}</p>
          <p className="text-xs text-muted-foreground">{contact.phoneNumber}{contact.projectTag ? ` · ${contact.projectTag}` : ""}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {isConnected ? (
            <Badge variant="outline" className="text-xs text-green-400 border-green-400/30 flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Live
            </Badge>
          ) : sseError ? (
            <Badge variant="outline" className="text-xs text-orange-400 border-orange-400/30 flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
              Reconnecting
            </Badge>
          ) : null}
          <Badge variant="outline" className="text-xs text-primary border-primary/30 flex items-center gap-1">
            <Bot className="w-3 h-3" />
            AI
          </Badge>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-4">
        {!conversation ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-center">
            <MessageSquare className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Send the first message to start the conversation.</p>
          </div>
        ) : sortedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-center">
            <MessageSquare className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No messages yet. Start typing below.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedMessages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            {isSending && (
              <div className="flex gap-2.5 flex-row-reverse">
                <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="bg-primary/10 border border-primary/20 rounded-2xl rounded-tr-sm px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                    <span className="text-xs text-primary">AI is thinking…</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {/* AI Pipeline Result Banner */}
      {lastResult && (
        <div className="mx-4 mb-2 flex items-center gap-3 bg-muted/50 border border-border rounded-lg px-3 py-2 text-xs text-muted-foreground">
          <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />
          <span>Processed:</span>
          {lastResult.memoryExtracted && (
            <span className="flex items-center gap-1 text-purple-400">
              <Brain className="w-3 h-3" /> Memory stored
            </span>
          )}
          {lastResult.issuesDetected > 0 && (
            <span className="flex items-center gap-1 text-orange-400">
              <AlertTriangle className="w-3 h-3" /> {lastResult.issuesDetected} issue{lastResult.issuesDetected > 1 ? "s" : ""} detected
            </span>
          )}
          {lastResult.visionTriggered && (
            <span className="flex items-center gap-1 text-blue-400">
              <Eye className="w-3 h-3" /> Vision AI running
            </span>
          )}
        </div>
      )}

      {/* Image preview */}
      {uploadedFile && (
        <div className="mx-4 mb-2 flex items-center gap-3 bg-card border border-border rounded-lg px-3 py-2">
          {uploadedFile.mimeType.startsWith("image/") ? (
            <img src={uploadedFile.localPreview} alt="preview" className="w-12 h-12 rounded object-cover" />
          ) : (
            <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
              <Paperclip className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-foreground truncate">{uploadedFile.name}</p>
            <p className="text-xs text-muted-foreground">{uploadedFile.mimeType}</p>
          </div>
          <button
            onClick={() => setUploadedFile(null)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Composer */}
      <div className="px-4 pb-4 pt-2 border-t border-border bg-card">
        <div className="flex items-end gap-2">
          {/* Attach file */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/mp4,application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
              e.target.value = "";
            }}
          />
          <Button
            variant="outline"
            size="sm"
            className="border-border text-muted-foreground hover:bg-muted h-10 w-10 p-0 shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isSending}
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
          </Button>

          {/* Text input */}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
            className="flex-1 min-h-[40px] max-h-32 resize-none bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            rows={1}
          />

          {/* Send */}
          <Button
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 w-10 p-0 shrink-0"
            onClick={handleSend}
            disabled={(!text.trim() && !uploadedFile) || isSending || isUploading}
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5 px-1">
          Messages are processed by AI: memory is stored, issues are detected, images are analyzed with vision AI.
        </p>
      </div>
    </div>
  );
}

// ─── New Contact Dialog ───────────────────────────────────────────────────────

function NewContactDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (contact: Contact) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [project, setProject] = useState("");

  const createContact = trpc.inbox.createContact.useMutation({
    onSuccess: (contact) => {
      toast.success(`Contact "${contact.displayName}" created`);
      onCreated(contact as Contact);
      setName(""); setPhone(""); setProject("");
      onClose();
    },
    onError: () => toast.error("Failed to create contact"),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border text-foreground max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-foreground">New Contact</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Display Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Smith"
              className="bg-input border-border text-foreground"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Phone / Identifier *</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +447911123456 or site-foreman-1"
              className="bg-input border-border text-foreground"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Project Tag (optional)</Label>
            <Input
              value={project}
              onChange={(e) => setProject(e.target.value)}
              placeholder="e.g. Site-A, Block-3"
              className="bg-input border-border text-foreground"
            />
          </div>
          <Button
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => createContact.mutate({ displayName: name, phoneNumber: phone, projectTag: project || undefined })}
            disabled={!name.trim() || !phone.trim() || createContact.isPending}
          >
            {createContact.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Create Contact
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ChatInbox() {
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showNewContact, setShowNewContact] = useState(false);

  const { data: contacts, isLoading, refetch } = trpc.contacts.list.useQuery({ limit: 200 });

  return (
    <DashboardShell title="Chat Inbox" subtitle="Send messages and images — full AI pipeline, no WhatsApp API required">
      <div className="flex h-[calc(100vh-140px)] rounded-xl overflow-hidden border border-border">
        {/* Left: Contact list */}
        <div className="w-72 shrink-0">
          <ContactPanel
            contacts={contacts ?? []}
            selected={selectedContact}
            onSelect={setSelectedContact}
            onNewContact={() => setShowNewContact(true)}
            isLoading={isLoading}
          />
        </div>

        {/* Right: Conversation */}
        <div className="flex-1 min-w-0">
          {selectedContact ? (
            <ConversationPanel contact={selectedContact} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center bg-background">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Select a contact</h3>
              <p className="text-sm text-muted-foreground max-w-xs mb-6">
                Choose a contact from the left to view the conversation, or create a new one to start chatting.
              </p>
              <Button
                variant="outline"
                className="border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => setShowNewContact(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                New Contact
              </Button>
            </div>
          )}
        </div>
      </div>

      <NewContactDialog
        open={showNewContact}
        onClose={() => setShowNewContact(false)}
        onCreated={(c) => {
          refetch();
          setSelectedContact(c);
        }}
      />
    </DashboardShell>
  );
}
