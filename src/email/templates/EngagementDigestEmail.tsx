import * as React from 'react';
import { Section, Row, Column, Text, Link } from '@react-email/components';
import { EmailLayout } from './components/EmailLayout';
import { Button } from './components/Button';
import { Title, Body as Paragraph } from './components/Typo';
import { colors, radius, fontStacks } from './components/theme';

export type NotificationType = 'reply' | 'reaction';

export interface DigestNotification {
  type: NotificationType;
  actor: string;
  snippet: string;
  ctaUrl: string;
}

export interface EngagementDigestEmailProps {
  name: string;
  notifications: DigestNotification[];
  assetBaseUrl: string;
  unsubscribeUrl: string;
}

export const subject = 'Senin için yeni hareketler var';

const LABELS: Record<NotificationType, { verb: string; icon: string; color: string }> = {
  reply: { verb: 'yanıtladı', icon: '↩', color: colors.lime },
  reaction: { verb: 'tepki verdi', icon: '♥', color: colors.danger },
};

function NotificationRow({ n }: { n: DigestNotification }) {
  const meta = LABELS[n.type];
  return (
    <Section
      style={{
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.card,
        padding: '14px 16px',
        marginBottom: '12px',
      }}
    >
      <Row>
        <Column style={{ width: '32px', verticalAlign: 'top' }}>
          <Text style={{ margin: 0, fontSize: '16px', color: meta.color, lineHeight: '1.4' }}>{meta.icon}</Text>
        </Column>
        <Column>
          <Text style={{ margin: '0 0 4px', fontFamily: fontStacks.body, fontSize: '14px', color: colors.text }}>
            <strong>{n.actor}</strong>{' '}
            <span style={{ color: colors.muted }}>gönderine {meta.verb}</span>
          </Text>
          <Text
            style={{
              margin: '0 0 10px',
              fontFamily: fontStacks.body,
              fontSize: '13px',
              lineHeight: '1.5',
              color: colors.muted,
              fontStyle: 'italic',
            }}
          >
            &ldquo;{n.snippet}&rdquo;
          </Text>
          <Link
            href={n.ctaUrl}
            style={{ fontFamily: fontStacks.body, fontSize: '13px', fontWeight: 700, color: colors.lime, textDecoration: 'none' }}
          >
            Görüntüle &raquo;
          </Link>
        </Column>
      </Row>
    </Section>
  );
}

export default function EngagementDigestEmail({
  name,
  notifications,
  assetBaseUrl,
  unsubscribeUrl,
}: EngagementDigestEmailProps) {
  return (
    <EmailLayout
      preview={`${notifications.length} yeni bildirim seni bekliyor.`}
      assetBaseUrl={assetBaseUrl}
      unsubscribeUrl={unsubscribeUrl}
      reason="Bu özeti, etkileşim bildirimlerini e-posta olarak almayı seçtiğin için aldın."
    >
      <Title>Senin için yeni hareketler</Title>
      <Paragraph muted>
        Merhaba {name}, yokken topluluk hareketliydi. Kaçırdıklarından bazıları:
      </Paragraph>

      <Section style={{ margin: '8px 0 4px' }}>
        {notifications.map((n, i) => (
          <NotificationRow key={`${n.actor}-${i}`} n={n} />
        ))}
      </Section>

      <Section style={{ marginTop: '12px' }}>
        <Button href="https://transferpulse.app/notifications" block>
          Tümünü Gör
        </Button>
      </Section>
    </EmailLayout>
  );
}
