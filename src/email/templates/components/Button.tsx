import * as React from 'react';
import { Button as REButton } from '@react-email/components';
import { colors, radius, fontStacks } from './theme';

export interface ButtonProps {
  href: string;
  variant?: 'fill' | 'outline';
  /** Tam genişlik buton (mobilde tıklanabilir alan). */
  block?: boolean;
  children: React.ReactNode;
}

/** Lime dolgulu birincil CTA + outline ikincil varyant. */
export function Button({ href, variant = 'fill', block, children }: ButtonProps) {
  const isFill = variant === 'fill';
  return (
    <REButton
      href={href}
      style={{
        backgroundColor: isFill ? colors.lime : 'transparent',
        color: isFill ? colors.limeText : colors.text,
        border: isFill ? 'none' : `1px solid ${colors.border}`,
        fontFamily: fontStacks.body,
        fontSize: '15px',
        fontWeight: 700,
        letterSpacing: '0.01em',
        textDecoration: 'none',
        textAlign: 'center',
        padding: '14px 28px',
        borderRadius: radius.button,
        display: block ? 'block' : 'inline-block',
        width: block ? '100%' : undefined,
        boxSizing: 'border-box',
      }}
    >
      {children}
    </REButton>
  );
}

export default Button;
