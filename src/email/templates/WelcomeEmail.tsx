import * as React from 'react';
import { Section, Row, Column, Text } from '@react-email/components';
import { EmailLayout } from './components/EmailLayout';
import { Button } from './components/Button';
import { Title, Body as Paragraph } from './components/Typo';
import { colors, fontStacks } from './components/theme';

export interface WelcomeEmailProps {
  name: string;
  ctaUrl: string;
  assetBaseUrl: string;
  unsubscribeUrl: string;
}

export const subject = "TransferPulse'a hoş geldin — sahaya çıkma vakti";

const FEATURES: ReadonlyArray<{ k: string; t: string; d: string }> = [
  { k: '01', t: 'Transferleri canlı takip et', d: 'Söylentiden resmi açıklamaya, her hamleyi anında gör.' },
  { k: '02', t: 'Pulse Score kazan', d: 'Tahminlerin ve etkileşimlerinle puan topla, sıralamada yüksel.' },
  { k: '03', t: 'Topluluğa katıl', d: 'Yorum yap, tepki ver, taraftarlarla tartış.' },
];

export default function WelcomeEmail({ name, ctaUrl, assetBaseUrl, unsubscribeUrl }: WelcomeEmailProps) {
  return (
    <EmailLayout
      preview={`Hoş geldin ${name} — transfer dünyası cebinde.`}
      assetBaseUrl={assetBaseUrl}
      unsubscribeUrl={unsubscribeUrl}
      reason="Bu e-postayı TransferPulse'a yeni kayıt olduğun için aldın."
    >
      <Title>Hoş geldin, {name} 👋</Title>
      <Paragraph muted>
        Aramıza katıldığına sevindik. TransferPulse, futbol transferlerini saniye saniye
        takip ettiğin, tahmin yürüttüğün ve taraftarlarla nabzı tuttuğun yer.
      </Paragraph>

      <Section style={{ margin: '8px 0 24px' }}>
        {FEATURES.map((f, i) => (
          <Row
            key={f.k}
            style={{ borderBottom: i < FEATURES.length - 1 ? `1px solid ${colors.border}` : 'none' }}
          >
            <Column style={{ width: '44px', verticalAlign: 'top', padding: '14px 0' }}>
              <Text
                style={{
                  margin: 0,
                  fontFamily: fontStacks.heading,
                  fontSize: '16px',
                  fontWeight: 800,
                  color: colors.lime,
                }}
              >
                {f.k}
              </Text>
            </Column>
            <Column style={{ padding: '14px 0' }}>
              <Text style={{ margin: '0 0 2px', fontFamily: fontStacks.body, fontSize: '15px', fontWeight: 600, color: colors.text }}>
                {f.t}
              </Text>
              <Text style={{ margin: 0, fontFamily: fontStacks.body, fontSize: '13px', lineHeight: '1.5', color: colors.muted }}>
                {f.d}
              </Text>
            </Column>
          </Row>
        ))}
      </Section>

      <Button href={ctaUrl} block>
        Keşfetmeye Başla
      </Button>
    </EmailLayout>
  );
}
