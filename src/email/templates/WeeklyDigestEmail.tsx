import * as React from 'react';
import { Section, Row, Column, Text } from '@react-email/components';
import { EmailLayout } from './components/EmailLayout';
import { Button } from './components/Button';
import { Title, Body as Paragraph, Eyebrow } from './components/Typo';
import { colors, radius, fontStacks } from './components/theme';

export interface WeeklyTopTransfer {
  playerName: string;
  fromTeam: string;
  toTeam: string;
  /** Önceden formatlanmış tutar, ör. "26M €". */
  fee: string;
}

export interface WeeklyDigestEmailProps {
  name: string;
  pulseScore: number;
  globalRank: number;
  /** Üst yüzde dilimi, ör. 50 → "TOP 50%". */
  rankPercentile: number;
  topTransfers: WeeklyTopTransfer[];
  ctaUrl: string;
  assetBaseUrl: string;
  unsubscribeUrl: string;
}

export const subject = 'Haftalık nabız: Pulse Score\'un ve öne çıkanlar';

function formatNumber(n: number): string {
  return n.toLocaleString('tr-TR');
}

export default function WeeklyDigestEmail({
  name,
  pulseScore,
  globalRank,
  rankPercentile,
  topTransfers,
  ctaUrl,
  assetBaseUrl,
  unsubscribeUrl,
}: WeeklyDigestEmailProps) {
  return (
    <EmailLayout
      preview={`Pulse Score ${formatNumber(pulseScore)} · Global #${formatNumber(globalRank)} — haftalık özetin.`}
      assetBaseUrl={assetBaseUrl}
      unsubscribeUrl={unsubscribeUrl}
      reason="Bu haftalık özeti, haftalık bültene abone olduğun için aldın."
    >
      <Title>Haftanın nabzı, {name}</Title>
      <Paragraph muted>İşte bu hafta TransferPulse'taki durumun ve gündemin özeti.</Paragraph>

      {/* Büyük lime skor kutusu — Profilim ekranı estetiği */}
      <Section
        style={{
          backgroundColor: colors.lime,
          borderRadius: radius.card,
          padding: '24px',
          marginBottom: '16px',
        }}
      >
        <Text
          style={{
            margin: '0 0 4px',
            fontFamily: fontStacks.heading,
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: colors.limeText,
          }}
        >
          Pulse Score
        </Text>
        <Text
          style={{
            margin: '0 0 16px',
            fontFamily: fontStacks.heading,
            fontSize: '56px',
            lineHeight: '1',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: colors.limeText,
          }}
        >
          {formatNumber(pulseScore)}
        </Text>
        <Row>
          <Column style={{ borderTop: '1px solid rgba(10,10,10,0.18)', paddingTop: '12px' }}>
            <Text style={{ margin: '0 0 2px', fontFamily: fontStacks.body, fontSize: '12px', fontWeight: 600, color: 'rgba(10,10,10,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Global Rank
            </Text>
            <Text style={{ margin: 0, fontFamily: fontStacks.heading, fontSize: '22px', fontWeight: 800, color: colors.limeText }}>
              #{formatNumber(globalRank)}
            </Text>
          </Column>
          <Column style={{ borderTop: '1px solid rgba(10,10,10,0.18)', paddingTop: '12px', textAlign: 'right' }}>
            <Text style={{ margin: '0 0 2px', fontFamily: fontStacks.body, fontSize: '12px', fontWeight: 600, color: 'rgba(10,10,10,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Dilim
            </Text>
            <Text style={{ margin: 0, fontFamily: fontStacks.heading, fontSize: '22px', fontWeight: 800, color: colors.limeText }}>
              TOP {rankPercentile}%
            </Text>
          </Column>
        </Row>
      </Section>

      {/* Haftanın öne çıkan transferleri */}
      <Eyebrow>Haftanın öne çıkanları</Eyebrow>
      <Section
        style={{
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: radius.card,
          padding: '6px 18px',
          marginBottom: '20px',
        }}
      >
        {topTransfers.map((t, i) => (
          <Row
            key={`${t.playerName}-${i}`}
            style={{ borderBottom: i < topTransfers.length - 1 ? `1px solid ${colors.border}` : 'none' }}
          >
            <Column style={{ padding: '14px 0' }}>
              <Text style={{ margin: '0 0 2px', fontFamily: fontStacks.body, fontSize: '14px', fontWeight: 600, color: colors.text }}>
                {t.playerName}
              </Text>
              <Text style={{ margin: 0, fontFamily: fontStacks.body, fontSize: '12px', color: colors.muted }}>
                {t.fromTeam} <span style={{ color: colors.lime }}>&raquo;&raquo;</span> {t.toTeam}
              </Text>
            </Column>
            <Column style={{ padding: '14px 0', textAlign: 'right', verticalAlign: 'middle' }}>
              <Text style={{ margin: 0, fontFamily: fontStacks.heading, fontSize: '15px', fontWeight: 800, color: colors.lime }}>
                {t.fee}
              </Text>
            </Column>
          </Row>
        ))}
      </Section>

      <Button href={ctaUrl} block>
        Haftalık Özetimi Aç
      </Button>
    </EmailLayout>
  );
}
