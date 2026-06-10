import * as React from 'react';
import { Section, Text } from '@react-email/components';
import { EmailLayout } from './components/EmailLayout';
import { Button } from './components/Button';
import { Title, Body as Paragraph } from './components/Typo';
import { colors, fontStacks } from './components/theme';
import { formatExpiry } from './components/format';

export interface PasswordResetEmailProps {
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
  assetBaseUrl: string;
  unsubscribeUrl: string;
}

export const subject = 'Şifre sıfırlama isteği — TransferPulse';

export default function PasswordResetEmail({
  name,
  resetUrl,
  expiresInMinutes,
  assetBaseUrl,
  unsubscribeUrl,
}: PasswordResetEmailProps) {
  return (
    <EmailLayout
      preview="Şifreni sıfırlamak için güvenli bağlantın hazır."
      assetBaseUrl={assetBaseUrl}
      unsubscribeUrl={unsubscribeUrl}
      reason="Bu e-postayı hesabın için bir şifre sıfırlama isteği alındığı için gönderdik."
    >
      <Title>Şifreni sıfırla</Title>
      <Paragraph muted>
        Merhaba {name}, hesabın için bir şifre sıfırlama isteği aldık. Yeni bir şifre
        belirlemek için aşağıdaki butona tıkla.
      </Paragraph>

      <Section style={{ margin: '8px 0 20px' }}>
        <Button href={resetUrl} block>
          Şifremi Sıfırla
        </Button>
      </Section>

      <Paragraph small muted>
        Güvenliğin için bu bağlantı yalnızca{' '}
        <strong style={{ color: colors.text }}>{formatExpiry(expiresInMinutes)}</strong> geçerlidir.
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
        {resetUrl}
      </Text>

      <Paragraph small muted>
        Bu isteği sen yapmadıysan endişelenme — şifren değişmedi. Bu e-postayı yok sayman yeterli.
      </Paragraph>
    </EmailLayout>
  );
}
