import * as React from 'react';
import { Section } from '@react-email/components';
import { EmailLayout } from './components/EmailLayout';
import { Button } from './components/Button';
import { Card } from './components/Card';
import { Badge } from './components/Badge';
import { InfoRow } from './components/InfoRow';
import { Title, Body as Paragraph, Eyebrow } from './components/Typo';
import { colors } from './components/theme';

export type ReportOutcome = 'upheld' | 'dismissed';

export interface ReportReviewedEmailProps {
  name: string;
  outcome: ReportOutcome;
  /** İçerik türü, ör. "yorum", "gönderi", "profil". */
  contentType: string;
  /** outcome 'upheld' ise uygulanan aksiyon, ör. "İçerik kaldırıldı". */
  actionTaken?: string;
  assetBaseUrl: string;
  unsubscribeUrl: string;
}

export const subject = 'Şikayetin sonuçlandı — TransferPulse';

export default function ReportReviewedEmail({
  name,
  outcome,
  contentType,
  actionTaken,
  assetBaseUrl,
  unsubscribeUrl,
}: ReportReviewedEmailProps) {
  const upheld = outcome === 'upheld';
  return (
    <EmailLayout
      preview={upheld ? 'Şikayetin haklı bulundu — gerekli aksiyon alındı.' : 'Şikayetini inceledik.'}
      assetBaseUrl={assetBaseUrl}
      unsubscribeUrl={unsubscribeUrl}
      reason="Bu e-postayı bir içeriği bize bildirdiğin için aldın."
    >
      <Eyebrow>Moderasyon sonucu</Eyebrow>
      <Title>Şikayetin değerlendirildi</Title>
      <Paragraph muted>
        Merhaba {name}, bildirdiğin {contentType} için yaptığımız incelemeyi tamamladık.
        Bizi haberdar ettiğin için teşekkürler — bu, topluluğu güvende tutmamıza yardımcı oluyor.
      </Paragraph>

      <Card>
        <Section style={{ marginBottom: '12px' }}>
          {upheld ? (
            <Badge variant="success" dot>
              Haklı bulundu
            </Badge>
          ) : (
            <Badge variant="muted">İhlal bulunamadı</Badge>
          )}
        </Section>
        <InfoRow label="İçerik türü" value={contentType} />
        <InfoRow
          label="Sonuç"
          value={upheld ? 'Kurallarımız ihlal edilmiş' : 'Kurallara aykırı değil'}
          valueColor={upheld ? colors.success : colors.muted}
          last={!upheld}
        />
        {upheld ? (
          <InfoRow label="Alınan aksiyon" value={actionTaken ?? 'Gerekli işlem uygulandı'} last />
        ) : null}
      </Card>

      <Paragraph small muted>
        {upheld
          ? 'Bildirdiğin içerik kurallarımızı ihlal ettiği için gerekli işlem uygulandı.'
          : 'İncelememiz sonucunda bu içeriğin kurallarımızı ihlal etmediğini değerlendirdik. Yine de katkın bizim için değerli.'}
      </Paragraph>

      <Section style={{ marginTop: '8px' }}>
        <Button href="https://transferpulse.app/guidelines" variant="outline">
          Topluluk Kurallarını Gör
        </Button>
      </Section>
    </EmailLayout>
  );
}
