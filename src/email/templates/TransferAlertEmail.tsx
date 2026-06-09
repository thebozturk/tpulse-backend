import * as React from 'react';
import { Section, Row, Column, Text, Link } from '@react-email/components';
import { EmailLayout } from './components/EmailLayout';
import { Badge } from './components/Badge';
import { Title, Body as Paragraph } from './components/Typo';
import { colors, radius, fontStacks } from './components/theme';

export type TransferStatus = 'rumour' | 'confirmed';

export interface TransferAlertItem {
  playerName: string;
  fromTeam: string;
  toTeam: string;
  /** Önceden formatlanmış tutar, ör. "26M €". */
  fee: string;
  status: TransferStatus;
  positionLabel?: string;
  ctaUrl: string;
}

export interface TransferAlertEmailProps {
  name: string;
  /** 1-5 transfer. */
  items: TransferAlertItem[];
  assetBaseUrl: string;
  unsubscribeUrl: string;
}

export const subject = 'Takip ettiğin transferlerde hareket var ⚡';

function feeVariant(status: TransferStatus): 'success' | 'warning' {
  return status === 'confirmed' ? 'success' : 'warning';
}

function TransferCard({ item }: { item: TransferAlertItem }) {
  const confirmed = item.status === 'confirmed';
  return (
    <Section
      style={{
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.card,
        padding: '16px 18px',
        marginBottom: '14px',
      }}
    >
      {/* Üst satır: durum rozeti + pozisyon */}
      <Row>
        <Column>
          {confirmed ? (
            <Badge variant="success">Resmi</Badge>
          ) : (
            <Badge variant="warning" dot>
              Söylenti
            </Badge>
          )}
        </Column>
        {item.positionLabel ? (
          <Column style={{ textAlign: 'right' }}>
            <Text style={{ margin: 0, fontFamily: fontStacks.body, fontSize: '12px', fontWeight: 600, color: colors.muted, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {item.positionLabel}
            </Text>
          </Column>
        ) : null}
      </Row>

      {/* Oyuncu adı */}
      <Text
        style={{
          margin: '12px 0 10px',
          fontFamily: fontStacks.heading,
          fontSize: '20px',
          fontWeight: 800,
          letterSpacing: '-0.01em',
          color: colors.text,
        }}
      >
        {item.playerName}
      </Text>

      {/* fromTeam >> toTeam */}
      <Row>
        <Column style={{ width: '42%' }}>
          <Text style={{ margin: 0, fontFamily: fontStacks.body, fontSize: '14px', color: colors.muted }}>
            {item.fromTeam}
          </Text>
        </Column>
        <Column style={{ width: '16%', textAlign: 'center' }}>
          <Text style={{ margin: 0, fontFamily: fontStacks.heading, fontSize: '18px', fontWeight: 800, color: colors.lime }}>
            &raquo;&raquo;
          </Text>
        </Column>
        <Column style={{ width: '42%', textAlign: 'right' }}>
          <Text style={{ margin: 0, fontFamily: fontStacks.body, fontSize: '14px', fontWeight: 700, color: colors.text }}>
            {item.toTeam}
          </Text>
        </Column>
      </Row>

      {/* Alt satır: tutar pill + CTA */}
      <Row style={{ marginTop: '14px' }}>
        <Column>
          <Badge variant={feeVariant(item.status)}>{item.fee}</Badge>
        </Column>
        <Column style={{ textAlign: 'right' }}>
          <Link
            href={item.ctaUrl}
            style={{
              fontFamily: fontStacks.body,
              fontSize: '13px',
              fontWeight: 700,
              color: colors.lime,
              textDecoration: 'none',
            }}
          >
            Detaylar &raquo;
          </Link>
        </Column>
      </Row>
    </Section>
  );
}

export default function TransferAlertEmail({
  name,
  items,
  assetBaseUrl,
  unsubscribeUrl,
}: TransferAlertEmailProps) {
  const shown = items.slice(0, 5);
  return (
    <EmailLayout
      preview={`${shown[0]?.playerName ?? 'Yeni transfer'} ve takip ettiğin diğer hareketler.`}
      assetBaseUrl={assetBaseUrl}
      unsubscribeUrl={unsubscribeUrl}
      reason="Bu e-postayı transfer uyarılarını açtığın için aldın."
      live
    >
      <Title>Transferlerde hareket var</Title>
      <Paragraph muted>
        Merhaba {name}, takip ettiğin oyuncu ve takımlarla ilgili son gelişmeler:
      </Paragraph>

      <Section style={{ marginTop: '8px' }}>
        {shown.map((item, i) => (
          <TransferCard key={`${item.playerName}-${i}`} item={item} />
        ))}
      </Section>
    </EmailLayout>
  );
}
