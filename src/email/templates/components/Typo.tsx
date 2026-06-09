import * as React from 'react';
import { Heading, Text } from '@react-email/components';
import { colors, fontStacks } from './theme';

/** Büyük, sıkışık, ağır başlık (Archivo). */
export function Title({ children }: { children: React.ReactNode }) {
  return (
    <Heading
      as="h1"
      style={{
        margin: '0 0 14px',
        fontFamily: fontStacks.heading,
        fontSize: '30px',
        lineHeight: '1.1',
        fontWeight: 800,
        letterSpacing: '-0.01em',
        color: colors.text,
      }}
    >
      {children}
    </Heading>
  );
}

/** Bölüm üstü küçük büyük-harf etiket. */
export function Eyebrow({ children, color = colors.lime }: { children: React.ReactNode; color?: string }) {
  return (
    <Text
      style={{
        margin: '0 0 10px',
        fontFamily: fontStacks.heading,
        fontSize: '13px',
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color,
      }}
    >
      {children}
    </Text>
  );
}

/** Gövde metni. */
export function Body({
  children,
  muted,
  small,
}: {
  children: React.ReactNode;
  muted?: boolean;
  small?: boolean;
}) {
  return (
    <Text
      style={{
        margin: '0 0 16px',
        fontFamily: fontStacks.body,
        fontSize: small ? '13px' : '15px',
        lineHeight: '1.65',
        color: muted ? colors.muted : '#E5E5E5',
      }}
    >
      {children}
    </Text>
  );
}

export default { Title, Eyebrow, Body };
