import * as React from 'react';
import { Section, Text } from '@react-email/components';
import { EmailLayout } from './components/EmailLayout';
import { Button } from './components/Button';
import { Card } from './components/Card';
import { Title, Body as Paragraph } from './components/Typo';
import { colors, fontStacks } from './components/theme';
import { formatExpiry } from './components/format';

export interface EmailChangeConfirmEmailProps {
  name: string;
  confirmUrl: string;
  newEmail: string;
  expiresInMinutes: number;
  assetBaseUrl: string;
  unsubscribeUrl: string;
}

export const subject = 'Yeni e-posta adresini onayla — TransferPulse';

export default function EmailChangeConfirmEmail({
  name,
  confirmUrl,
  newEmail,
  expiresInMinutes,
  assetBaseUrl,
  unsubscribeUrl,
}: EmailChangeConfirmEmailProps) {
  return (
    <EmailLayout
      preview="E-posta değişikliğini onaylamak için son bir adım."
      assetBaseUrl={assetBaseUrl}
      unsubscribeUrl={unsubscribeUrl}
      reason="Bu e-postayı, hesabının e-posta adresini değiştirmek istediğin için aldın."
    >
      <Title>Yeni e-postanı onayla</Title>
      <Paragraph muted>
        Merhaba {name}, hesabının e-posta adresini aşağıdaki adresle değiştirmek istediğini
        gördük. Değişikliği tamamlamak için onayla.
      </Paragraph>

      <Card elevated>
        <Text style={{ margin: '0 0 4px', fontFamily: fontStacks.body, fontSize: '13px', color: colors.muted }}>
          Yeni e-posta adresi
        </Text>
        <Text style={{ margin: 0, fontFamily: fontStacks.body, fontSize: '16px', fontWeight: 600, color: colors.lime }}>
          {newEmail}
        </Text>
      </Card>

      <Section style={{ margin: '20px 0' }}>
        <Button href={confirmUrl} block>
          Yeni E-postamı Onayla
        </Button>
      </Section>

      <Paragraph small muted>
        Bu bağlantı <strong style={{ color: colors.text }}>{formatExpiry(expiresInMinutes)}</strong> geçerlidir.
        Bu değişikliği sen talep etmediysen lütfen bu e-postayı yok say; adresin değişmeyecek.
      </Paragraph>
    </EmailLayout>
  );
}
