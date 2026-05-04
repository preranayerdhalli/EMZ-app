import { type TextInputProps } from 'react-native';
import { TextField } from '@/components/ui/TextField';

type GlassInputProps = {
  label: string;
  placeholder?: string;
  value: string;
  onChangeText: (t: string) => void;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  keyboardType?: TextInputProps['keyboardType'];
  autoComplete?: TextInputProps['autoComplete'];
  editable?: boolean;
};

export function GlassInput({
  label,
  placeholder = 'you@example.com',
  value,
  onChangeText,
  autoCapitalize = 'none',
  keyboardType = 'email-address',
  autoComplete,
  editable,
}: GlassInputProps) {
  return (
    <TextField
      label={label}
      placeholder={placeholder}
      value={value}
      onChangeText={onChangeText}
      autoCapitalize={autoCapitalize}
      keyboardType={keyboardType}
      autoComplete={autoComplete}
      editable={editable}
      accessibilityLabel={label}
    />
  );
}
