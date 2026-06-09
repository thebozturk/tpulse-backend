import * as React from 'react';
import { colors, radius, fontStacks } from './theme';

export type BadgeVariant = 'lime' | 'success' | 'warning' | 'danger' | 'muted';

export interface BadgeProps {
  variant?: BadgeVariant;
  /** Solda yanıp sönen nokta görünümü (● CANLI / ● SÖYLENTI gibi). */
  dot?: boolean;
  children: React.ReactNode;
}

const VARIANT_MAP: Record<BadgeVariant, { fg: string; bg: string }> = {
  lime: { fg: colors.limeText, bg: colors.lime },
  success: { fg: colors.success, bg: 'rgba(61,214,140,0.14)' },
  warning: { fg: colors.warning, bg: 'rgba(245,166,35,0.14)' },
  danger: { fg: colors.danger, bg: 'rgba(247,85,79,0.14)' },
  muted: { fg: colors.muted, bg: 'rgba(161,161,161,0.14)' },
};

/** Pill rozet. Email içinde inline-block <span> olarak render edilir. */
export function Badge({ variant = 'muted', dot, children }: BadgeProps) {
  const { fg, bg } = VARIANT_MAP[variant];
  return (
    <span
      style={{
        display: 'inline-block',
        backgroundColor: bg,
        color: fg,
        fontFamily: fontStacks.body,
        fontSize: '12px',
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        lineHeight: '1',
        padding: '7px 11px',
        borderRadius: radius.pill,
      }}
    >
      {dot ? <span style={{ color: fg, marginRight: '6px' }}>●</span> : null}
      {children}
    </span>
  );
}

export default Badge;
