import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import { AI_AGENTS } from '@/lib/mock-data';
import { trpc } from '@/lib/trpc';
import type { AIMessage, AIAgentType, AIAgent } from '@/lib/types';
import { useCompany } from '@/lib/company-context';

const QUICK_PROMPTS: Record<AIAgentType, string[]> = {
  construction_domain: [
    'What are the BS standards for concrete mix design?',
    'Explain the difference between RC and post-tensioned slabs',
    'What fire resistance is required for a 32-storey residential tower?',
  ],
  safety_compliance: [
    'What PPE is required for confined space entry?',
    'Draft a toolbox talk for working at height',
    'What are the RIDDOR reporting requirements?',
  ],
  cost_estimation: [
    'What is the typical cost per m² for concrete frame construction?',
    'Estimate labour cost for 500m² of drylining',
    'What contingency % should I allow for a refurbishment project?',
  ],
  project_coordinator: [
    'How do I create a critical path for a tower block project?',
    'What are the key milestones for a concrete frame project?',
    'How should I manage a subcontractor delay?',
  ],
  defects: [
    'How do I categorise and prioritise snag items?',
    'What is the typical defects liability period under JCT?',
    'Draft an NCR for concrete honeycombing',
  ],
  contracts: [
    'Explain the difference between JCT and NEC contracts',
    'What are the payment notice requirements under JCT?',
    'How do I issue a variation instruction?',
  ],
  valuations: [
    'How do I prepare an interim payment application?',
    'What is the difference between a PC sum and a provisional sum?',
    'How do I calculate retention under JCT?',
  ],
  team_management: [
    'What CSCS cards are required for different trades?',
    'How do I manage CIS deductions for subcontractors?',
    'What are the IR35 rules for construction workers?',
  ],
};

export default function AIScreen() {
  const colors = useColors();
  const { currentProject, currentCompany } = useCompany();
  const companyId = currentCompany?.id ?? 1;
  const [selectedAgent, setSelectedAgent] = useState<AIAgent>(AI_AGENTS[0]);
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello! I'm your **${AI_AGENTS[0].name}** — here to help with ${AI_AGENTS[0].description.toLowerCase()}.\n\nAsk me anything about your construction projects, or choose a quick prompt below to get started.`,
      agentType: AI_AGENTS[0].type,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const chatMutation = trpc.ai.chat.useMutation();

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: AIMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      // Build conversation history for the API (exclude the welcome message)
      const conversationHistory = updatedMessages
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      const result = await chatMutation.mutateAsync({
        companyId,
        agentType: selectedAgent.type,
        messages: conversationHistory,
        projectContext: currentProject
          ? `Active project: ${currentProject.name} (${currentProject.address || 'address not set'}, status ${currentProject.status})`
          : undefined,
      });

      const assistantMsg: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: typeof result.content === 'string' ? result.content : JSON.stringify(result.content),
        agentType: selectedAgent.type,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      // Fallback response on error
      const errorMsg: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologise, I was unable to connect to the AI service. Please check your connection and try again.',
        agentType: selectedAgent.type,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [companyId, isLoading, selectedAgent, messages, chatMutation, currentProject]);

  const selectAgent = (agent: AIAgent) => {
    setSelectedAgent(agent);
    setShowAgentPicker(false);
    setMessages([{
      id: Date.now().toString(),
      role: 'assistant',
      content: `Switched to **${agent.name}**. I specialise in ${agent.description.toLowerCase()}.\n\nHow can I help you today?`,
      agentType: agent.type,
      timestamp: new Date().toISOString(),
    }]);
  };

  const renderMessage = ({ item }: { item: AIMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageRow, isUser && styles.messageRowUser]}>
        {!isUser && (
          <View style={[styles.agentAvatar, { backgroundColor: selectedAgent.color }]}>
            <IconSymbol name="cpu.fill" size={14} color="#FFFFFF" />
          </View>
        )}
        <View style={[
          styles.bubble,
          isUser
            ? [styles.bubbleUser, { backgroundColor: colors.primary }]
            : [styles.bubbleAssistant, { backgroundColor: colors.surface, borderColor: colors.border }],
        ]}>
          <Text style={[
            styles.bubbleText,
            { color: isUser ? '#FFFFFF' : colors.foreground },
          ]}>
            {item.content}
          </Text>
          <Text style={[styles.bubbleTime, { color: isUser ? 'rgba(255,255,255,0.6)' : colors.muted }]}>
            {new Date(item.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer containerClassName="bg-background">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: '#1E3A5F' }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>AI Agent</Text>
            <TouchableOpacity
              style={styles.agentSelector}
              onPress={() => setShowAgentPicker(!showAgentPicker)}
            >
              <View style={[styles.agentDot, { backgroundColor: selectedAgent.color }]} />
              <Text style={styles.agentName}>{selectedAgent.name}</Text>
              <IconSymbol name={showAgentPicker ? 'chevron.left' : 'chevron.right'} size={12} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: 'rgba(34,197,94,0.2)' }]}>
            <View style={[styles.statusDot, { backgroundColor: '#22C55E' }]} />
            <Text style={styles.statusText}>Online</Text>
          </View>
        </View>

        {/* Agent Picker */}
        {showAgentPicker && (
          <View style={[styles.agentPicker, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.agentPickerScroll}>
              {AI_AGENTS.map(agent => (
                <TouchableOpacity
                  key={agent.type}
                  style={[
                    styles.agentChip,
                    { borderColor: colors.border },
                    selectedAgent.type === agent.type && { backgroundColor: agent.color + '20', borderColor: agent.color },
                  ]}
                  onPress={() => selectAgent(agent)}
                >
                  <View style={[styles.agentChipDot, { backgroundColor: agent.color }]} />
                  <Text style={[
                    styles.agentChipText,
                    { color: selectedAgent.type === agent.type ? agent.color : colors.muted },
                  ]}>
                    {agent.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={
            isLoading ? (
              <View style={styles.typingIndicator}>
                <View style={[styles.agentAvatar, { backgroundColor: selectedAgent.color }]}>
                  <IconSymbol name="cpu.fill" size={14} color="#FFFFFF" />
                </View>
                <View style={[styles.typingBubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <ActivityIndicator size="small" color={selectedAgent.color} />
                  <Text style={[styles.typingText, { color: colors.muted }]}>Thinking...</Text>
                </View>
              </View>
            ) : null
          }
        />

        {/* Quick Prompts */}
        {messages.length <= 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickPromptsScroll}
          >
            {(QUICK_PROMPTS[selectedAgent.type] ?? []).map((prompt, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.quickPrompt, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => sendMessage(prompt)}
              >
                <Text style={[styles.quickPromptText, { color: colors.foreground }]}>{prompt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Input */}
        <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder={`Ask ${selectedAgent.name}...`}
            placeholderTextColor={colors.muted}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: input.trim() ? colors.primary : colors.border }]}
            onPress={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
          >
            <IconSymbol name="paperplane.fill" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  agentSelector: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  agentDot: { width: 8, height: 8, borderRadius: 4 },
  agentName: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { color: '#22C55E', fontSize: 12, fontWeight: '600' },
  agentPicker: { borderBottomWidth: 1, paddingVertical: 10 },
  agentPickerScroll: { paddingHorizontal: 16, gap: 8 },
  agentChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, borderWidth: 1 },
  agentChipDot: { width: 8, height: 8, borderRadius: 4 },
  agentChipText: { fontSize: 13, fontWeight: '600' },
  messagesList: { paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  messageRowUser: { flexDirection: 'row-reverse' },
  agentAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bubble: { maxWidth: '80%', borderRadius: 18, padding: 12, gap: 4 },
  bubbleUser: { borderBottomRightRadius: 4 },
  bubbleAssistant: { borderWidth: 1, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTime: { fontSize: 10, alignSelf: 'flex-end' },
  typingIndicator: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, borderWidth: 1 },
  typingText: { fontSize: 13 },
  quickPromptsScroll: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  quickPrompt: { maxWidth: 240, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  quickPromptText: { fontSize: 13, lineHeight: 18 },
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, gap: 10 },
  input: { flex: 1, fontSize: 15, maxHeight: 100, paddingVertical: 8, paddingHorizontal: 4 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
