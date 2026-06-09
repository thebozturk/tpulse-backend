import * as React from 'react';
import { Section } from '@react-email/components';
import { colors, radius, spacing } from './theme';

export interface CardProps {
  /** İsteğe bağlı vurgu rengi — sol kenarda ince şerit. */
  accent?: string;
  /** elevated arka plan kullan (iç içe kartlar için). */
  elevated?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Yüzey kartı: surface arka plan, 1px border, 14px radius.
 * Tailwind class'ı desteklemeyen client'lar için inline style fallback içerir.
 */
export function Card({ accent, elevated, className, children }: CardProps) {
  return (
    <Section
      className={className}
      style={{
        backgroundColor: elevated ? colors.elevated : colors.surface,
        border: `1px solid ${colors.border}`,
        borderLeft: accent ? `3px solid ${accent}` : `1px solid ${colors.border}`,
        borderRadius: radius.card,
        padding: spacing.card,
      }}
    >
      {children}
    </Section>
  );
}

export default Card;
