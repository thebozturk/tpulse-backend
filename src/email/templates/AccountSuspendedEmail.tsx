import * as React from 'react';
import { Section } from '@react-email/components';
import { EmailLayout } from './components/EmailLayout';
import { Button } from './components/Button';
import { Card } from './components/Card';
import { Badge } from './components/Badge';
import { Title, Body as Paragraph, Eyebrow } from './components/Typo';
import { colors } from './components/theme';

export interface AccountSuspendedEmailProps {
  name: string;
  reason: string;
  /** Önceden formatlanmış bitiş zamanı; verilmezse "ikinci bir bildirime kadar". */
  until?: string;
  appealUrl: string;
  assetBaseUrl: string;
  unsubscribeUrl: string;
}

export const subject = 'Hesabın geçici olarak askıya alındı — TransferPulse';

export default function AccountSuspendedEmail({
  name,
  reason,
  until,
  appealUrl,
  assetBaseUrl,
  unsubscribeUrl,
}: AccountSuspendedEmailProps) {
  return (
    <EmailLayout
      preview="Hesabın geçici olarak askıya alındı. Detaylar içeride."
      assetBaseUrl={assetBaseUrl}
      unsubscribeUrl={unsubscribeUrl}
      reason="Bu bildirimi hesabınla ilgili bir moderasyon kararı nedeniyle aldın."
    >
      <Eyebrow color={colors.warning}>Hesap durumu</Eyebrow>
      <Title>Hesabın askıya alındı</Title>
      <Paragraph muted>
        Merhaba {name}, topluluk kurallarımızı ihlal ettiğini tespit ettiğimiz için hesabın
        geçici olarak askıya alındı. Bu süre boyunca paylaşım yapamaz ve etkileşimde bulunamazsın.
      </Paragraph>

      <Card accent={colors.warning}>
        <Section style={{ marginBottom: '12px' }}>
          <Badge variant="warning">Askıya alındı</Badge>
        </Section>
        <Paragraph small>
          <strong style={{ color: colors.text }}>Sebep:</strong>{' '}
          <span style={{ color: colors.muted }}>{reason}</span>
        </Paragraph>
        <Paragraph small>
          <strong style={{ color: colors.text }}>Süre:</strong>{' '}
          <span style={{ color: colors.muted }}>{until ?? 'İkinci bir bildirime kadar'}</span>
        </Paragraph>
      </Card>

      <Section style={{ margin: '20px 0 8px' }}>
        <Button href={appealUrl} variant="outline">
          Karara İtiraz Et
        </Button>
      </Section>

      <Paragraph small muted>
        Bir hata olduğunu düşünüyorsan yukarıdaki bağlantıdan itiraz edebilirsin. İtirazını
        en kısa sürede inceleyeceğiz.
      </Paragraph>
    </EmailLayout>
  );
}
