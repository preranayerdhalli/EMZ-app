import { Modal, Text, StyleSheet, Pressable } from 'react-native';
import { AppBackground } from '@/components/AuthBackground';
import { colors, fonts } from '@/constants/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function AnimationScreen({ visible, onClose }: Props) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <AppBackground>
        <Pressable style={styles.screen} onPress={onClose}>
          <Text style={styles.label}>Animations coming soon</Text>
        </Pressable>
      </AppBackground>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    fontFamily: fonts.bodyRegular,
    color: colors.ink.secondary,
  },
});
