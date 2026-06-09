import * as React from 'react';
import { Section, Text } from '@react-email/components';
import { EmailLayout } from './components/EmailLayout';
import { Button } from './components/Button';
import { Badge } from './components/Badge';
import { Title, Body as Paragraph } from './components/Typo';
import { colors, fontStacks } from './components/theme';

export interface BroadcastEmailProps {
  title: string;
  /** Ya hazır HTML gövdesi (güvenilir admin kaynağı) ya da düz metin ver. */
  bodyHtml?: string;
  bodyText?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  /** Rozet etiketi; verilmezse "DUYURU". */
  badgeLabel?: string;
  assetBaseUrl: string;
  unsubscribeUrl: string;
}

export const subject = 'TransferPulse duyurusu';

export default function BroadcastEmail({
  title,
  bodyHtml,
  bodyText,
  ctaLabel,
  ctaUrl,
  badgeLabel,
  assetBaseUrl,
  unsubscribeUrl,
}: BroadcastEmailProps) {
  return (
    <EmailLayout
      preview={title}
      assetBaseUrl={assetBaseUrl}
      unsubscribeUrl={unsubscribeUrl}
      reason="Bu duyuruyu TransferPulse topluluğunun bir üyesi olduğun için aldın."
    >
      <Section style={{ marginBottom: '14px' }}>
        <Badge variant="lime">{badgeLabel ?? 'Duyuru'}</Badge>
      </Section>

      <Title>{title}</Title>

      {bodyHtml ? (
        <div
          style={{ fontFamily: fontStacks.body, fontSize: '15px', lineHeight: '1.65', color: '#E5E5E5' }}
          // Gövde, güvenilir admin panelinden gelen sanitize edilmiş HTML'dir.
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      ) : (
        (bodyText ?? '')
          .split('\n')
          .filter((line) => line.trim().length > 0)
          .map((line, i) => (
            <Paragraph key={i}>{line}</Paragraph>
          ))
      )}

      {ctaUrl && ctaLabel ? (
        <Section style={{ marginTop: '20px' }}>
          <Button href={ctaUrl} block>
            {ctaLabel}
          </Button>
        </Section>
      ) : null}

      <Text style={{ marginTop: '8px', fontFamily: fontStacks.body, fontSize: '13px', color: colors.muted }}>
        Saygılarımızla,
        <br />
        TransferPulse Ekibi
      </Text>
    </EmailLayout>
  );
}
