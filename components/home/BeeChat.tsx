import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
  Animated,
  Easing,
  Switch,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fonts, palette } from '@/constants/theme';
import { useChat, type Message, type ChatSession, msgUid } from '@/context/ChatContext';

// ─── Constants (match app background: light theme) ───────────────────────────

const INPUT_BG = 'rgba(255,255,255,0.92)';
const BORDER = colors.glassBorderSubtle;
const LIST_ROW = 'rgba(31,26,20,0.04)';
const BANNER_BLUE = '#5B9BF5';
const FAB_SIZE = 52;
const FAB_PILL_WIDTH = 128;

function ChatBackground({ children }: { children: React.ReactNode }) {
  return (
    <View style={chatBgStyles.container}>
      <LinearGradient
        colors={[colors.offWhite, '#F5F7FF', '#EEF5FF']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(30, 58, 95, 0.18)', 'rgba(30, 58, 95, 0.06)', 'transparent']}
        locations={[0, 0.08, 0.22]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(120, 160, 255, 0.26)', 'transparent']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.4, y: 0.6 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(255,163,102,0.0)', 'rgba(255,179,120,0.22)', 'rgba(255,204,3,0.20)']}
        start={{ x: 0, y: 0.45 }}
        end={{ x: 0.45, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}
const chatBgStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.offWhite },
});

type Personality = 'friendly' | 'motivating' | 'direct';

const EMZ_REPLIES: Record<Personality, string[]> = {
  friendly: [
    "That sounds important! Want me to add it to your task list?",
    "I hear you. Let's break that down together — what's the first small step?",
    "You've got this! How about I help you schedule some time for that?",
  ],
  motivating: [
    "Yes! Let's make this happen — want to block time for it right now?",
    "Every big goal starts with one step. You've already taken it by saying this out loud!",
    "Progress, not perfection. What's one small win you can get today?",
  ],
  direct: [
    "Got it. Should I schedule time for this?",
    "Understood. What's the deadline?",
    "Clear. Want this added to your task list?",
  ],
};

const MOCK_TRANSCRIPTIONS = [
  "I need to finish the report by Friday",
  "Remind me to call my doctor this week",
  "I want to start waking up earlier",
];

const PERSONALITY_OPTIONS: { value: Personality; label: string; desc: string }[] = [
  { value: 'friendly', label: 'Friendly', desc: 'Warm and supportive' },
  { value: 'motivating', label: 'Motivating', desc: 'Energetic and encouraging' },
  { value: 'direct', label: 'Direct', desc: 'Concise and action-focused' },
];

function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function formatChatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - ts;
  if (diff < 86400000) return 'Today';
  if (diff < 172800000) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

type Props = { visible: boolean; onClose: () => void };

export function BeeChat({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { chats, activeChatId, activeChat, newChat, switchChat, deleteChat, addMessage } = useChat();

  const [viewMode, setViewMode] = useState<'list' | 'conversation'>('conversation');
  const [draft, setDraft] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [personality, setPersonality] = useState<Personality>('friendly');
  const [voiceResponses, setVoiceResponses] = useState(false);
  const [autoSend, setAutoSend] = useState(true);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voicePhase, setVoicePhase] = useState<'idle' | 'listening' | 'processing'>('idle');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const listRef = useRef<FlatList>(null);
  const fabAnim = useRef(new Animated.Value(0)).current;
  const voiceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;

  const startDotAnimation = useCallback(() => {
    const makeDot = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: -6, duration: 300, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
          Animated.timing(anim, { toValue: 0, duration: 300, useNativeDriver: true, easing: Easing.in(Easing.ease) }),
          Animated.delay(600 - delay),
        ])
      );
    Animated.parallel([makeDot(dot1, 0), makeDot(dot2, 150), makeDot(dot3, 300)]).start();
  }, [dot1, dot2, dot3]);

  const stopDotAnimation = useCallback(() => {
    [dot1, dot2, dot3].forEach((d) => d.stopAnimation(() => d.setValue(0)));
  }, [dot1, dot2, dot3]);

  const startRingAnimation = useCallback(() => {
    const makeRing = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 1400, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
    Animated.parallel([makeRing(ring1, 0), makeRing(ring2, 460), makeRing(ring3, 920)]).start();
  }, [ring1, ring2, ring3]);

  const stopRingAnimation = useCallback(() => {
    [ring1, ring2, ring3].forEach((r) => r.stopAnimation(() => r.setValue(0)));
  }, [ring1, ring2, ring3]);

  useEffect(() => {
    if (isTyping) startDotAnimation();
    else stopDotAnimation();
  }, [isTyping, startDotAnimation, stopDotAnimation]);

  useEffect(() => {
    if (voicePhase === 'listening') startRingAnimation();
    else stopRingAnimation();
  }, [voicePhase, startRingAnimation, stopRingAnimation]);

  useEffect(() => {
    if (visible) {
      setDraft('');
      setIsTyping(false);
      setVoiceOpen(false);
      setVoicePhase('idle');
      setSettingsOpen(false);
      setSearchQuery('');
      setViewMode('conversation');
      if (chats.length === 0) newChat();
    }
  }, [visible]);

  // FAB: "New Chat" pill → "+" circle when chat list is shown
  useEffect(() => {
    if (visible && viewMode === 'list') {
      fabAnim.setValue(0);
      const t = setTimeout(() => {
        Animated.timing(fabAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: false,
          easing: Easing.bezier(0.34, 1.56, 0.64, 1),
        }).start();
      }, 2200);
      return () => clearTimeout(t);
    }
  }, [visible, viewMode]);

  const scrollToBottom = () => setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);

  const sendText = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      const chatId = activeChatId ?? newChat();
      const userMsg: Message = { id: msgUid(), role: 'user', text: text.trim() };
      addMessage(chatId, userMsg);
      setDraft('');
      scrollToBottom();
      setIsTyping(true);
      setTimeout(() => {
        const pool = EMZ_REPLIES[personality];
        addMessage(chatId, { id: msgUid(), role: 'bee', text: pool[Math.floor(Math.random() * pool.length)] });
        setIsTyping(false);
        scrollToBottom();
      }, 1200 + Math.random() * 800);
    },
    [activeChatId, personality, addMessage, newChat]
  );

  const handleNewChat = () => {
    newChat();
    setViewMode('conversation');
  };

  const handleBack = () => {
    if (viewMode === 'conversation') setViewMode('list');
    else onClose();
  };

  const handleDeleteChat = (chat: ChatSession) => {
    Alert.alert('Delete chat', `Delete "${chat.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteChat(chat.id) },
    ]);
  };

  const openVoice = () => {
    setVoiceOpen(true);
    setVoicePhase('listening');
    voiceTimer.current = setTimeout(() => {
      setVoicePhase('processing');
      voiceTimer.current = setTimeout(() => {
        const transcribed = MOCK_TRANSCRIPTIONS[Math.floor(Math.random() * MOCK_TRANSCRIPTIONS.length)];
        setVoiceOpen(false);
        setVoicePhase('idle');
        if (autoSend) sendText(transcribed);
        else setDraft(transcribed);
      }, 800);
    }, 3000);
  };

  const cancelVoice = () => {
    if (voiceTimer.current) clearTimeout(voiceTimer.current);
    setVoiceOpen(false);
    setVoicePhase('idle');
  };

  const makeRingStyle = (anim: Animated.Value) => ({
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
    opacity: anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.6, 0.3, 0] }),
  });

  const messages = activeChat?.messages ?? [];
  const hasUserMessages = messages.some((m) => m.role === 'user');
  const showWelcome = !hasUserMessages && messages.length <= 1;
  const timeOfDay = getTimeGreeting();

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    if (item.id === 'opening' && !hasUserMessages) return null;
    return (
      <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowBee]}>
        {!isUser && (
          <Image source={require('@/assets/images/bee.png')} style={styles.avatar} resizeMode="contain" />
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBee]}>
          <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextBee]}>{item.text}</Text>
        </View>
      </View>
    );
  };

  // ─── Chat list view: Chats header, search, list, FAB (New Chat → +) ─────────
  const filteredChats = searchQuery.trim()
    ? chats.filter((c) => c.title.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : chats;

  if (viewMode === 'list') {
    const fabWidth = fabAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [FAB_PILL_WIDTH, FAB_SIZE],
    });
    const fabTextOpacity = fabAnim.interpolate({
      inputRange: [0, 0.6],
      outputRange: [1, 0],
    });
    const fabIconOpacity = fabAnim.interpolate({
      inputRange: [0.4, 1],
      outputRange: [0, 1],
    });

    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <ChatBackground>
        <View style={[styles.root, { paddingTop: insets.top }]}>
          <View style={styles.header}>
            <Pressable style={styles.headerBackWrap} onPress={onClose} accessibilityLabel="Close">
              <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
            </Pressable>
            <View style={styles.headerSpacer} />
            <Text style={styles.headerTitle}>Chats</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={20} color={colors.textTertiary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search Chats"
              placeholderTextColor={colors.textTertiary}
              returnKeyType="search"
            />
          </View>

          <FlatList
            data={filteredChats}
            keyExtractor={(c) => c.id}
            style={styles.listScroll}
            contentContainerStyle={[styles.listScrollContent, { paddingBottom: insets.bottom + FAB_SIZE + spacing.lg }]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={styles.listEmptyText}>
                {searchQuery.trim() ? 'No chats match your search.' : 'No chats yet.'}
              </Text>
            }
            renderItem={({ item: chat }) => (
              <Pressable
                style={styles.chatRow}
                onPress={() => {
                  switchChat(chat.id);
                  setViewMode('conversation');
                }}
              >
                <View style={styles.chatRowContent}>
                  <Text style={styles.chatRowTitle} numberOfLines={1}>{chat.title}</Text>
                  <Text style={styles.chatRowDate}>{formatChatDate(chat.updatedAt)}</Text>
                </View>
                <Pressable
                  style={styles.chatRowDelete}
                  onPress={() => handleDeleteChat(chat)}
                  hitSlop={12}
                  accessibilityLabel="Delete chat"
                >
                  <Ionicons name="trash-outline" size={20} color={colors.coral} />
                </Pressable>
              </Pressable>
            )}
          />

          <Animated.View style={[styles.fab, { right: spacing.lg, bottom: insets.bottom + spacing.lg, width: fabWidth, height: FAB_SIZE, borderRadius: FAB_SIZE / 2 }]}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={handleNewChat}
              accessibilityLabel="New chat"
              accessibilityRole="button"
            >
              <Animated.View style={[styles.fabContent, { opacity: fabTextOpacity }]} pointerEvents="none">
                <Text style={styles.fabText}>New Chat</Text>
              </Animated.View>
              <Animated.View style={[styles.fabIconWrap, { opacity: fabIconOpacity }]} pointerEvents="none">
                <Ionicons name="add" size={28} color={colors.bodyText} />
              </Animated.View>
            </Pressable>
          </Animated.View>
        </View>
        </ChatBackground>
      </Modal>
    );
  }

  // ─── Conversation view (Claude: header + welcome or thread + input bar) ───
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ChatBackground>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable style={styles.headerBackWrap} onPress={() => setViewMode('list')} accessibilityLabel="Back to chats">
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.headerSpacer} />
        </View>

        {showWelcome ? (
          <View style={styles.welcomeWrap}>
            <View style={styles.welcomeIconWrap}>
              <Image source={require('@/assets/images/bee.png')} style={styles.welcomeIcon} resizeMode="contain" />
            </View>
            <Text style={styles.welcomeText}>How can I help you this {timeOfDay}?</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={scrollToBottom}
            ListFooterComponent={
              isTyping ? (
                <View style={[styles.msgRow, styles.msgRowBee]}>
                  <Image source={require('@/assets/images/bee.png')} style={styles.avatar} resizeMode="contain" />
                  <View style={[styles.bubble, styles.bubbleBee, styles.typingBubble]}>
                    <Animated.View style={[styles.typingDot, { transform: [{ translateY: dot1 }] }]} />
                    <Animated.View style={[styles.typingDot, { transform: [{ translateY: dot2 }] }]} />
                    <Animated.View style={[styles.typingDot, { transform: [{ translateY: dot3 }] }]} />
                  </View>
                </View>
              ) : null
            }
          />
        )}

        {/* Single input bar (Claude-style: one pill with +, input, mic, waveform) */}
        <View style={[styles.inputBarWrap, { paddingBottom: insets.bottom + 16, paddingHorizontal: spacing.md }]}>
          <View style={styles.inputPill}>
            <Pressable style={styles.inputPillPlus} onPress={handleNewChat} accessibilityLabel="New chat">
              <Ionicons name="add" size={22} color={colors.textSecondary} />
            </Pressable>
            <TextInput
              style={styles.inputPillInput}
              value={draft}
              onChangeText={setDraft}
              placeholder="Chat with EMZ..."
              placeholderTextColor={colors.textTertiary}
              multiline
              maxLength={500}
              returnKeyType="send"
              blurOnSubmit={false}
              onSubmitEditing={() => sendText(draft)}
            />
            <Pressable style={styles.inputPillIcon} onPress={openVoice} accessibilityLabel="Voice input">
              <Ionicons name="mic-outline" size={22} color={colors.textSecondary} />
            </Pressable>
            <Pressable
              style={styles.inputPillIcon}
              onPress={() => (draft.trim() ? sendText(draft) : undefined)}
              accessibilityLabel={draft.trim() ? 'Send' : 'Voice / sound'}
            >
              <Ionicons
                name="pulse-outline"
                size={22}
                color={draft.trim() ? colors.primaryYellow : BANNER_BLUE}
              />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
      </ChatBackground>

      {/* Voice overlay */}
      <Modal visible={voiceOpen} transparent animationType="fade" onRequestClose={cancelVoice}>
        <View style={styles.voiceOverlay}>
          <View style={styles.voiceCard}>
            <View style={styles.voiceRingWrap}>
              <Animated.View style={[styles.voiceRing, makeRingStyle(ring1)]} />
              <Animated.View style={[styles.voiceRing, makeRingStyle(ring2)]} />
              <Animated.View style={[styles.voiceRing, makeRingStyle(ring3)]} />
              <View style={[styles.voiceMicCircle, voicePhase === 'processing' && styles.voiceMicCircleProcessing]}>
                <Ionicons
                  name={voicePhase === 'processing' ? 'hourglass-outline' : 'mic'}
                  size={32}
                  color={voicePhase === 'processing' ? colors.textSecondary : colors.bodyText}
                />
              </View>
            </View>
            <Text style={styles.voiceLabel}>
              {voicePhase === 'listening' ? 'Listening…' : 'Transcribing…'}
            </Text>
            <Pressable style={styles.voiceCancelBtn} onPress={cancelVoice}>
              <Text style={styles.voiceCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Settings sheet */}
      <Modal visible={settingsOpen} transparent animationType="slide" onRequestClose={() => setSettingsOpen(false)}>
        <Pressable style={styles.settingsOverlay} onPress={() => setSettingsOpen(false)}>
          <Pressable style={[styles.settingsSheet, { paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
            <View style={styles.settingsHandle} />
            <Text style={styles.settingsTitle}>Chat Settings</Text>
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              <Text style={styles.settingsSection}>EMZ Personality</Text>
              <View style={styles.personalityRow}>
                {PERSONALITY_OPTIONS.map(({ value, label, desc }) => (
                  <Pressable
                    key={value}
                    style={[styles.personalityChip, personality === value && styles.personalityChipActive]}
                    onPress={() => setPersonality(value)}
                  >
                    <Text style={[styles.personalityLabel, personality === value && styles.personalityLabelActive]}>{label}</Text>
                    <Text style={[styles.personalityDesc, personality === value && styles.personalityDescActive]}>{desc}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.settingsSection}>Voice</Text>
              <View style={styles.settingsCard}>
                <View style={styles.settingsRow}>
                  <View style={styles.settingsRowLeft}>
                    <Ionicons name="volume-medium-outline" size={18} color={colors.textSecondary} />
                    <Text style={styles.settingsRowLabel}>Voice responses</Text>
                  </View>
                  <Switch
                    value={voiceResponses}
                    onValueChange={setVoiceResponses}
                    trackColor={{ false: 'rgba(255,255,255,0.12)', true: 'rgba(255,204,3,0.4)' }}
                    thumbColor={voiceResponses ? colors.primaryYellow : 'rgba(255,255,255,0.5)'}
                  />
                </View>
                <View style={styles.settingsDivider} />
                <View style={styles.settingsRow}>
                  <View style={styles.settingsRowLeft}>
                    <Ionicons name="send-outline" size={18} color={colors.textSecondary} />
                    <Text style={styles.settingsRowLabel}>Auto-send after voice</Text>
                  </View>
                  <Switch
                    value={autoSend}
                    onValueChange={setAutoSend}
                    trackColor={{ false: 'rgba(255,255,255,0.12)', true: 'rgba(255,204,3,0.4)' }}
                    thumbColor={autoSend ? colors.primaryYellow : 'rgba(255,255,255,0.5)'}
                  />
                </View>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  headerBtn: { padding: 8 },
  headerBackWrap: {
    padding: 8,
    marginLeft: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: BORDER,
  },
  headerSpacer: { flex: 1, minWidth: 44 },
  headerTitle: { fontSize: 17, fontFamily: fonts.bodyMedium, color: colors.textPrimary },
  headerBee: { width: 28, height: 28 },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: INPUT_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  searchIcon: { marginRight: 10 },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    paddingVertical: 0,
  },

  listScroll: { flex: 1 },
  listScrollContent: { paddingHorizontal: spacing.md, paddingTop: 4 },
  listEmptyText: {
    fontSize: 15,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: spacing.md,
    backgroundColor: LIST_ROW,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  chatRowContent: { flex: 1, minWidth: 0 },
  chatRowTitle: { fontSize: 16, fontFamily: fonts.bodyRegular, color: colors.textPrimary },
  chatRowDate: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  chatRowDelete: { padding: 10 },

  fab: {
    position: 'absolute',
    backgroundColor: colors.primaryYellow,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  fabContent: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  fabIconWrap: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  fabText: { fontSize: 16, fontFamily: fonts.bodyMedium, color: colors.bodyText },

  welcomeWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  welcomeIconWrap: {
    marginBottom: 28,
  },
  welcomeIcon: {
    width: 88,
    height: 88,
    opacity: 0.95,
  },
  welcomeText: {
    fontSize: 28,
    fontFamily: fonts.bodyMedium,
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 36,
    paddingHorizontal: 16,
  },

  listContent: { paddingHorizontal: spacing.md, paddingTop: 20, paddingBottom: 12 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 12 },
  msgRowBee: { justifyContent: 'flex-start' },
  msgRowUser: { justifyContent: 'flex-end' },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,204,3,0.12)',
    flexShrink: 0,
  },
  bubble: { maxWidth: '78%', borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14 },
  bubbleBee: {
    backgroundColor: INPUT_BG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    borderBottomLeftRadius: 4,
  },
  bubbleUser: { backgroundColor: colors.primaryYellow, borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  bubbleTextBee: { color: colors.textPrimary },
  bubbleTextUser: { color: colors.bodyText, fontFamily: fonts.bodyRegular },

  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 14, paddingHorizontal: 16 },
  typingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.textSecondary },

  inputBarWrap: { paddingTop: 12 },
  inputPill: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    backgroundColor: INPUT_BG,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    paddingLeft: 6,
    paddingRight: 6,
    paddingVertical: 6,
  },
  inputPillPlus: { padding: 8 },
  inputPillInput: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    paddingVertical: 8,
    paddingHorizontal: 8,
    maxHeight: 100,
  },
  inputPillIcon: { padding: 8 },

  voiceOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceCard: {
    width: 280,
    backgroundColor: colors.offWhite,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
    gap: 12,
  },
  voiceRingWrap: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  voiceRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primaryYellow,
  },
  voiceMicCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryYellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceMicCircleProcessing: { backgroundColor: 'rgba(31,26,20,0.08)' },
  voiceLabel: { fontSize: 18, fontFamily: fonts.bodyMedium, color: colors.textPrimary },
  voiceCancelBtn: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 999,
    backgroundColor: 'rgba(31,26,20,0.08)',
  },
  voiceCancelText: { fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.textSecondary },

  settingsOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  settingsSheet: {
    backgroundColor: colors.offWhite,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: BORDER,
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    maxHeight: '85%',
  },
  settingsHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(31,26,20,0.2)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  settingsTitle: { fontSize: 18, fontFamily: fonts.bodyMedium, color: colors.textPrimary, marginBottom: 20 },
  settingsSection: {
    fontSize: 11,
    fontFamily: fonts.bodyMedium,
    color: colors.textTertiary,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 20,
  },
  settingsCard: {
    backgroundColor: INPUT_BG,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  settingsRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  settingsRowLabel: { fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.textPrimary },
  settingsDivider: { height: StyleSheet.hairlineWidth, backgroundColor: BORDER, marginHorizontal: 14 },
  personalityRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  personalityChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    gap: 3,
  },
  personalityChipActive: {
    backgroundColor: 'rgba(255,204,3,0.12)',
    borderColor: 'rgba(255,204,3,0.45)',
  },
  personalityLabel: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.textSecondary },
  personalityLabelActive: { color: colors.primaryYellow },
  personalityDesc: { fontSize: 10, color: colors.textTertiary, textAlign: 'center' },
  personalityDescActive: { color: 'rgba(26,43,60,0.7)' },
});
