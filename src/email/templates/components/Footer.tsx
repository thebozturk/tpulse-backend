import * as React from 'react';
import { Section, Text, Link, Hr } from '@react-email/components';
import { colors, fontStacks, BRAND } from './theme';

export interface FooterProps {
  unsubscribeUrl: string;
  /** "Bu e-postayı X nedeniyle aldınız" açıklaması. */
  reason: string;
}

const linkStyle: React.CSSProperties = {
  color: colors.muted,
  fontFamily: fontStacks.body,
  fontSize: '12px',
  textDecoration: 'underline',
};

/** Marka, sosyal linkler, yasal metin ve abonelikten çıkma. */
export function Footer({ unsubscribeUrl, reason }: FooterProps) {
  return (
    <Section style={{ padding: '8px 0 4px' }}>
      <Hr style={{ borderColor: colors.border, margin: '0 0 20px' }} />

      <Text
        style={{
          margin: '0 0 6px',
          fontFamily: fontStacks.heading,
          fontSize: '15px',
          fontWeight: 800,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          color: colors.text,
        }}
      >
        <span>{BRAND.wordmarkA}</span>
        <span style={{ color: colors.lime }}>{BRAND.wordmarkB}</span>
      </Text>

      <Text style={{ margin: '0 0 14px' }}>
        <Link href="https://transferpulse.app/x" style={{ ...linkStyle, textDecoration: 'none', marginRight: '14px' }}>
          X
        </Link>
        <Link href="https://transferpulse.app/instagram" style={{ ...linkStyle, textDecoration: 'none', marginRight: '14px' }}>
          Instagram
        </Link>
        <Link href="https://transferpulse.app/tiktok" style={{ ...linkStyle, textDecoration: 'none' }}>
          TikTok
        </Link>
      </Text>

      <Text
        style={{
          margin: '0 0 10px',
          fontFamily: fontStacks.body,
          fontSize: '12px',
          lineHeight: '1.6',
          color: colors.muted,
        }}
      >
        {reason}
      </Text>

      <Text style={{ margin: 0, fontFamily: fontStacks.body, fontSize: '12px', color: colors.muted }}>
        <Link href={unsubscribeUrl} style={linkStyle}>
          Abonelikten çık
        </Link>
        <span style={{ margin: '0 8px', color: colors.border }}>·</span>
        <Link href="https://transferpulse.app/privacy" style={linkStyle}>
          Gizlilik
        </Link>
        <span style={{ margin: '0 8px', color: colors.border }}>·</span>
        <Link href="https://transferpulse.app/terms" style={linkStyle}>
          Koşullar
        </Link>
      </Text>
    </Section>
  );
}

export default Footer;
