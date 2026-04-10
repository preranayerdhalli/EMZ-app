import { TextField } from '@/components/ui/TextField';

type GlassInputProps = {
  label: string;
  placeholder?: string;
  value: string;
  onChangeText: (t: string) => void;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'email-address';
  autoComplete?: string;
};

export function GlassInput({
  label,
  placeholder = 'you@example.com',
  value,
  onChangeText,
  autoCapitalize = 'none',
  keyboardType = 'email-address',
  autoComplete,
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
      accessibilityLabel={label}
    />
  );
}
