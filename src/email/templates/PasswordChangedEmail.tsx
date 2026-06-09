import * as React from 'react';
import { Section } from '@react-email/components';
import { EmailLayout } from './components/EmailLayout';
import { Button } from './components/Button';
import { Card } from './components/Card';
import { InfoRow } from './components/InfoRow';
import { Title, Body as Paragraph, Eyebrow } from './components/Typo';
import { colors } from './components/theme';

export interface PasswordChangedEmailProps {
  name: string;
  /** Önceden formatlanmış zaman, ör. "9 Haziran 2026, 14:32 (GMT+3)". */
  changedAt: string;
  ipAddress?: string;
  assetBaseUrl: string;
  supportUrl: string;
  unsubscribeUrl: string;
}

export const subject = 'Şifren değiştirildi — TransferPulse';

export default function PasswordChangedEmail({
  name,
  changedAt,
  ipAddress,
  assetBaseUrl,
  supportUrl,
  unsubscribeUrl,
}: PasswordChangedEmailProps) {
  return (
    <EmailLayout
      preview="Hesabının şifresi az önce güncellendi."
      assetBaseUrl={assetBaseUrl}
      unsubscribeUrl={unsubscribeUrl}
      reason="Bu güvenlik bildirimini hesabının şifresi değiştiği için aldın."
    >
      <Eyebrow color={colors.success}>Güvenlik bildirimi</Eyebrow>
      <Title>Şifren değiştirildi</Title>
      <Paragraph muted>
        Merhaba {name}, TransferPulse hesabının şifresi başarıyla güncellendi. İşlem detayları:
      </Paragraph>

      <Card>
        <InfoRow label="Zaman" value={changedAt} />
        <InfoRow label="IP adresi" value={ipAddress ?? 'Kayıtlı değil'} last={!ipAddress} />
        {ipAddress ? <InfoRow label="Hesap" value={name} last /> : null}
      </Card>

      <Section style={{ height: '20px' }} />

      <Card accent={colors.danger}>
        <Paragraph>
          <strong style={{ color: colors.danger }}>Bu işlemi sen yapmadın mı?</strong>
        </Paragraph>
        <Paragraph small muted>
          Hesabının güvenliği tehlikede olabilir. Hemen destek ekibimizle iletişime geç;
          erişimini güvene almana yardımcı olalım.
        </Paragraph>
        <Button href={supportUrl} variant="outline">
          Destekle İletişime Geç
        </Button>
      </Card>
    </EmailLayout>
  );
}
