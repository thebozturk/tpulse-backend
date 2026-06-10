/**
 * react-email dev server'da kullanılan örnek prop'lar.
 * Gerçekçi Türkçe veriler. assetBaseUrl yereldeki preview için localhost'a işaret eder.
 */
import type { WelcomeEmailProps } from '../WelcomeEmail';
import type { VerifyEmailProps } from '../VerifyEmail';
import type { PasswordResetEmailProps } from '../PasswordResetEmail';
import type { PasswordChangedEmailProps } from '../PasswordChangedEmail';
import type { EmailChangeConfirmEmailProps } from '../EmailChangeConfirmEmail';
import type { AccountSuspendedEmailProps } from '../AccountSuspendedEmail';
import type { AccountBannedEmailProps } from '../AccountBannedEmail';
import type { ReportReviewedEmailProps } from '../ReportReviewedEmail';
import type { TransferAlertEmailProps } from '../TransferAlertEmail';
import type { EngagementDigestEmailProps } from '../EngagementDigestEmail';
import type { WeeklyDigestEmailProps } from '../WeeklyDigestEmail';
import type { BroadcastEmailProps } from '../BroadcastEmail';
import type { LaunchEmailProps } from '../LaunchEmail';

const assetBaseUrl = 'https://cdn.transferpulse.app/email';
const unsubscribeUrl = 'https://transferpulse.app/abonelik/cik?t=demo';

export const launchProps: LaunchEmailProps = {
  ctaUrl: 'https://transferpulse.app/kesfet',
  assetBaseUrl,
  unsubscribeUrl,
};

export const welcomeProps: WelcomeEmailProps = {
  name: 'Mert',
  ctaUrl: 'https://transferpulse.app/kesfet',
  assetBaseUrl,
  unsubscribeUrl,
};

export const verifyProps: VerifyEmailProps = {
  name: 'Mert',
  verifyUrl: 'https://transferpulse.app/dogrula?token=eyJhbGciOiJI',
  expiresInMinutes: 30,
  assetBaseUrl,
  unsubscribeUrl,
};

export const passwordResetProps: PasswordResetEmailProps = {
  name: 'Mert',
  resetUrl: 'https://transferpulse.app/sifre-sifirla?token=eyJhbGciOiJI',
  expiresInMinutes: 15,
  assetBaseUrl,
  unsubscribeUrl,
};

export const passwordChangedProps: PasswordChangedEmailProps = {
  name: 'Mert',
  changedAt: '9 Haziran 2026, 14:32 (GMT+3)',
  ipAddress: '85.105.42.18 · İstanbul, TR',
  assetBaseUrl,
  supportUrl: 'https://transferpulse.app/destek',
  unsubscribeUrl,
};

export const emailChangeProps: EmailChangeConfirmEmailProps = {
  name: 'Mert',
  confirmUrl: 'https://transferpulse.app/eposta-onayla?token=eyJhbGciOiJI',
  newEmail: 'mert.yilmaz@gmail.com',
  expiresInMinutes: 60,
  assetBaseUrl,
  unsubscribeUrl,
};

export const suspendedProps: AccountSuspendedEmailProps = {
  name: 'Mert',
  reason: 'Tekrarlanan spam yorumlar ve istenmeyen bağlantı paylaşımı.',
  until: '16 Haziran 2026, 14:00 (GMT+3)',
  appealUrl: 'https://transferpulse.app/itiraz?case=SP-10472',
  assetBaseUrl,
  unsubscribeUrl,
};

export const bannedProps: AccountBannedEmailProps = {
  name: 'Mert',
  reason: 'Nefret söylemi ve taciz içeren içeriklerin tekrarı (3. ihlal).',
  appealUrl: 'https://transferpulse.app/itiraz?case=BN-2048',
  assetBaseUrl,
  unsubscribeUrl,
};

export const reportUpheldProps: ReportReviewedEmailProps = {
  name: 'Mert',
  outcome: 'upheld',
  contentType: 'yorum',
  actionTaken: 'İçerik kaldırıldı ve kullanıcı uyarıldı.',
  assetBaseUrl,
  unsubscribeUrl,
};

export const reportDismissedProps: ReportReviewedEmailProps = {
  name: 'Mert',
  outcome: 'dismissed',
  contentType: 'gönderi',
  assetBaseUrl,
  unsubscribeUrl,
};

export const transferAlertProps: TransferAlertEmailProps = {
  name: 'Mert',
  items: [
    {
      playerName: 'Stefan Savić',
      fromTeam: 'Atlético Madrid',
      toTeam: 'Trabzonspor',
      fee: '26M €',
      status: 'confirmed',
      positionLabel: 'Stoper',
      ctaUrl: 'https://transferpulse.app/transfer/savic-trabzonspor',
    },
    {
      playerName: 'Arda Güler',
      fromTeam: 'Real Madrid',
      toTeam: 'Fenerbahçe',
      fee: '40M €',
      status: 'rumour',
      positionLabel: 'Ofansif Orta Saha',
      ctaUrl: 'https://transferpulse.app/transfer/guler-fenerbahce',
    },
    {
      playerName: 'Mauro Icardi',
      fromTeam: 'Galatasaray',
      toTeam: 'Al-Nassr',
      fee: '18M €',
      status: 'rumour',
      positionLabel: 'Santrfor',
      ctaUrl: 'https://transferpulse.app/transfer/icardi-alnassr',
    },
  ],
  assetBaseUrl,
  unsubscribeUrl,
};

export const engagementProps: EngagementDigestEmailProps = {
  name: 'Mert',
  notifications: [
    {
      type: 'reply',
      actor: 'kerem_10',
      snippet: 'Savić bu fiyata kelepir, Trabzon savunması uçar resmen.',
      ctaUrl: 'https://transferpulse.app/gonderi/8842#yanit-21',
    },
    {
      type: 'reaction',
      actor: 'transfer_dedikoducu',
      snippet: 'Arda Güler tahminin tuttu, +120 Pulse Score!',
      ctaUrl: 'https://transferpulse.app/gonderi/8842',
    },
    {
      type: 'reply',
      actor: 'cimbom1905',
      snippet: 'Icardi gitmez, alın bu yazıyı çerçeveletin.',
      ctaUrl: 'https://transferpulse.app/gonderi/8911#yanit-7',
    },
  ],
  assetBaseUrl,
  unsubscribeUrl,
};

export const weeklyProps: WeeklyDigestEmailProps = {
  name: 'Mert',
  pulseScore: 12480,
  globalRank: 5000,
  rankPercentile: 50,
  topTransfers: [
    {
      playerName: 'Stefan Savić',
      fromTeam: 'Atlético Madrid',
      toTeam: 'Trabzonspor',
      fee: '26M €',
    },
    {
      playerName: 'Victor Osimhen',
      fromTeam: 'Napoli',
      toTeam: 'Galatasaray',
      fee: '75M €',
    },
    {
      playerName: 'Edin Džeko',
      fromTeam: 'Fenerbahçe',
      toTeam: 'Como',
      fee: 'Bonservissiz',
    },
  ],
  ctaUrl: 'https://transferpulse.app/haftalik-ozet',
  assetBaseUrl,
  unsubscribeUrl,
};

export const broadcastProps: BroadcastEmailProps = {
  title: 'Yeni: Canlı Transfer Odaları yayında!',
  bodyText:
    'Transfer döneminin nabzını artık canlı tutuyoruz. Büyük transferlerde gerçek zamanlı sohbet odalarına katıl, taraftarlarla anı paylaş.\nİlk oda Osimhen transferi için açıldı — şimdi gir, sözünü söyle.',
  ctaLabel: 'Canlı Odaya Katıl',
  ctaUrl: 'https://transferpulse.app/canli/osimhen',
  badgeLabel: 'Breaking',
  assetBaseUrl,
  unsubscribeUrl,
};
