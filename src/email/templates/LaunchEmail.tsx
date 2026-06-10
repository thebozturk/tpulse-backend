import * as React from 'react';
import { Section, Text } from '@react-email/components';
import { EmailLayout } from './components/EmailLayout';
import { Button } from './components/Button';
import { Badge } from './components/Badge';
import { Title, Body as Paragraph } from './components/Typo';
import { colors, fontStacks } from './components/theme';
import { LAUNCH_EMAIL_CONTENT } from '../launch.content';

/**
 * Waitlist lansman duyurusu — içeriği sabittir (launch.content.ts), yalnızca
 * tam CTA URL'i + marka alanları dışarıdan gelir. AI ile tasarımı bu dosyada
 * yeniden kurulur.
 */
export interface LaunchEmailProps {
  /** Tam CTA URL'i (servis `webUrl + ctaPath` ile kurar). */
  ctaUrl: string;
  assetBaseUrl: string;
  unsubscribeUrl: string;
}

export const subject = LAUNCH_EMAIL_CONTENT.subject;

export default function LaunchEmail({
  ctaUrl,
  assetBaseUrl,
  unsubscribeUrl,
}: LaunchEmailProps) {
  return (
    <EmailLayout
      preview={LAUNCH_EMAIL_CONTENT.preview}
      assetBaseUrl={assetBaseUrl}
      unsubscribeUrl={unsubscribeUrl}
      live
      reason="Bu duyuruyu TransferPulse lansman listesine kaydolduğun için aldın."
    >
      <Section style={{ marginBottom: '14px' }}>
        <Badge variant="lime">{LAUNCH_EMAIL_CONTENT.badgeLabel}</Badge>
      </Section>

      <Title>{LAUNCH_EMAIL_CONTENT.heading}</Title>

      {LAUNCH_EMAIL_CONTENT.paragraphs.map((line, i) => (
        <Paragraph key={i}>{line}</Paragraph>
      ))}

      <Section style={{ marginTop: '20px' }}>
        <Button href={ctaUrl} block>
          {LAUNCH_EMAIL_CONTENT.ctaLabel}
        </Button>
      </Section>

      <Text
        style={{
          marginTop: '8px',
          fontFamily: fontStacks.body,
          fontSize: '13px',
          color: colors.muted,
        }}
      >
        Saygılarımızla,
        <br />
        TransferPulse Ekibi
      </Text>
    </EmailLayout>
  );
}
