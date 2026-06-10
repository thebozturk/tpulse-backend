import * as React from 'react';
import { Section, Text } from '@react-email/components';
import { EmailLayout } from './components/EmailLayout';
import { Button } from './components/Button';
import { Title, Body as Paragraph } from './components/Typo';
import { colors, fontStacks } from './components/theme';
import { formatExpiry } from './components/format';

export interface VerifyEmailProps {
  name: string;
  verifyUrl: string;
  expiresInMinutes: number;
  assetBaseUrl: string;
  unsubscribeUrl: string;
}

export const subject = 'E-postanı doğrula — TransferPulse';

export default function VerifyEmail({
  name,
  verifyUrl,
  expiresInMinutes,
  assetBaseUrl,
  unsubscribeUrl,
}: VerifyEmailProps) {
  return (
    <EmailLayout
      preview="Hesabını aktive etmek için e-postanı doğrula."
      assetBaseUrl={assetBaseUrl}
      unsubscribeUrl={unsubscribeUrl}
      reason="Bu e-postayı TransferPulse hesabı oluşturduğun için aldın."
    >
      <Title>E-postanı doğrula</Title>
      <Paragraph muted>
        Merhaba {name}, hesabını kullanmaya başlamak için e-posta adresini doğrulaman gerekiyor.
        Aşağıdaki butona tıkla, gerisini biz halledelim.
      </Paragraph>

      <Section style={{ margin: '8px 0 20px' }}>
        <Button href={verifyUrl} block>
          E-postamı Doğrula
        </Button>
      </Section>

      <Paragraph small muted>
        Bu bağlantı <strong style={{ color: colors.text }}>{formatExpiry(expiresInMinutes)}</strong> boyunca geçerlidir.
        Buton çalışmazsa şu adresi tarayıcına yapıştır:
      </Paragraph>
      <Text
        style={{
          margin: '0 0 16px',
          fontFamily: fontStacks.body,
          fontSize: '12px',
          lineHeight: '1.5',
          color: colors.lime,
          wordBreak: 'break-all',
        }}
      >
        {verifyUrl}
      </Text>

      <Paragraph small muted>
        Bu hesabı sen oluşturmadıysan bu e-postayı yok sayabilirsin.
      </Paragraph>
    </EmailLayout>
  );
}
