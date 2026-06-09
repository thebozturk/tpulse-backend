import * as React from 'react';
import { Section } from '@react-email/components';
import { EmailLayout } from './components/EmailLayout';
import { Button } from './components/Button';
import { Card } from './components/Card';
import { Badge } from './components/Badge';
import { Title, Body as Paragraph, Eyebrow } from './components/Typo';
import { colors } from './components/theme';

export interface AccountBannedEmailProps {
  name: string;
  reason: string;
  appealUrl: string;
  assetBaseUrl: string;
  unsubscribeUrl: string;
}

export const subject = 'Hesabın kalıcı olarak kapatıldı — TransferPulse';

export default function AccountBannedEmail({
  name,
  reason,
  appealUrl,
  assetBaseUrl,
  unsubscribeUrl,
}: AccountBannedEmailProps) {
  return (
    <EmailLayout
      preview="Hesabın kalıcı olarak kapatıldı."
      assetBaseUrl={assetBaseUrl}
      unsubscribeUrl={unsubscribeUrl}
      reason="Bu bildirimi hesabınla ilgili kalıcı bir moderasyon kararı nedeniyle aldın."
    >
      <Eyebrow color={colors.danger}>Hesap durumu</Eyebrow>
      <Title>Hesabın kalıcı olarak kapatıldı</Title>
      <Paragraph muted>
        Merhaba {name}, tekrarlanan veya ağır kural ihlalleri nedeniyle hesabın TransferPulse'tan
        kalıcı olarak kaldırıldı. Bu karar, platformun tamamına erişimini sonlandırır.
      </Paragraph>

      <Card accent={colors.danger}>
        <Section style={{ marginBottom: '12px' }}>
          <Badge variant="danger">Kalıcı ban</Badge>
        </Section>
        <Paragraph small>
          <strong style={{ color: colors.text }}>Sebep:</strong>{' '}
          <span style={{ color: colors.muted }}>{reason}</span>
        </Paragraph>
      </Card>

      <Section style={{ margin: '20px 0 8px' }}>
        <Button href={appealUrl} variant="outline">
          İtiraz Et / İletişime Geç
        </Button>
      </Section>

      <Paragraph small muted>
        Bu kararın yanlış verildiğini düşünüyorsan itiraz sürecini başlatabilirsin. İtirazlar
        ekibimiz tarafından tek tek değerlendirilir.
      </Paragraph>
    </EmailLayout>
  );
}
