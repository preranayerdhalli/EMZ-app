import { View, Text, Pressable, StyleSheet, Modal, Switch } from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, fonts, palette } from '@/constants/theme';
import type { CalendarSource } from '@/constants/calendarTypes';

type CalendarConnection = {
  source: CalendarSource;
  connected: boolean;
  visible?: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  connections: CalendarConnection[];
  onConnect: (source: CalendarSource) => void;
  onToggleVisible: (source: CalendarSource, visible: boolean) => void;
};

type ServiceConfig = {
  name: string;
  subtitle: string;
  icon: React.ReactNode;
  accentColor: string;
  iconBg: string;
};

/* Single accent for Connect/Connected UI so all providers look consistent */
const CONNECT_ACCENT = colors.primaryYellow;

const SERVICE: Record<CalendarSource, ServiceConfig> = {
  google: {
    name: 'Google Calendar',
    subtitle: 'gmail.com account',
    icon: <FontAwesome5 name="google" size={20} color="#fff" />,
    accentColor: CONNECT_ACCENT,
    iconBg: '#4285F4',
  },
  microsoft: {
    name: 'Microsoft Outlook',
    subtitle: 'outlook.com / Exchange',
    icon: <FontAwesome5 name="microsoft" size={20} color="#fff" />,
    accentColor: CONNECT_ACCENT,
    iconBg: '#0078D4',
  },
  apple: {
    name: 'Apple Calendar',
    subtitle: 'iCloud account',
    icon: <FontAwesome5 name="apple" size={22} color="#fff" />,
    accentColor: CONNECT_ACCENT,
    iconBg: '#444444',
  },
};

export function ConnectedCalendarsSheet({
  visible,
  onClose,
  connections,
  onConnect,
  onToggleVisible,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Sync Calendars</Text>
              <Text style={styles.subtitle}>Sync your existing calendars</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.onDarkTertiary} />
            </Pressable>
          </View>

          {/* Calendar rows */}
          <View style={styles.list}>
            {connections.map(({ source, connected, visible: isVisible = true }) => {
              const svc = SERVICE[source];
              return (
                <View key={source} style={styles.row}>
                  {/* Logo */}
                  <View style={[styles.logoWrap, { backgroundColor: svc.iconBg }]}>
                    {svc.icon}
                  </View>

                  {/* Name + subtitle */}
                  <View style={styles.info}>
                    <Text style={styles.name}>{svc.name}</Text>
                    <Text style={styles.rowSubtitle}>{svc.subtitle}</Text>
                  </View>

                  {/* Action */}
                  {connected ? (
                    <View style={styles.connectedActions}>
                      <View style={styles.connectedBadge}>
                        <View style={[styles.connectedDot, { backgroundColor: svc.accentColor }]} />
                        <Text style={styles.connectedTxt}>Connected</Text>
                      </View>
                      <Switch
                        value={isVisible}
                        onValueChange={(val) => onToggleVisible(source, val)}
                        trackColor={{ false: 'rgba(255,255,255,0.15)', true: svc.accentColor + 'AA' }}
                        thumbColor={isVisible ? svc.accentColor : 'rgba(255,255,255,0.5)'}
                        ios_backgroundColor="rgba(255,255,255,0.15)"
                        style={styles.switch}
                      />
                    </View>
                  ) : (
                    <Pressable
                      style={[styles.connectBtn, { borderColor: svc.accentColor + '60' }]}
                      onPress={() => onConnect(source)}
                    >
                      <Text style={[styles.connectBtnTxt, { color: svc.accentColor }]}>
                        Connect
                      </Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.sheetBg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['3xl'],
    borderTopWidth: 1,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.onDarkText,
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.onDarkSecondary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Rows */
  list: {
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: borderRadius.cardSm,
    padding: 14,
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  logoWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  info: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontSize: 15,
    fontWeight: '650',
    color: colors.onDarkText,
  },
  rowSubtitle: {
    fontSize: 12,
    color: colors.onDarkTertiary,
  },

  /* Connected state */
  connectedActions: {
    alignItems: 'flex-end',
    gap: 6,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  connectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  connectedTxt: {
    fontSize: 12,
    color: colors.onDarkSecondary,
    fontFamily: fonts.bodyRegular,
  },
  switch: {
    transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }],
  },

  /* Connect button */
  connectBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: borderRadius.button,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  connectBtnTxt: {
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
  },
});
