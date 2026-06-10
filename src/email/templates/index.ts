/**
 * Render helper'ları — EmailService bunları çağırıp dönen `html`'i Resend'e verir.
 *
 * Not: @react-email/render >= 1.0 `render()` Promise döndürür; bu yüzden tüm
 * helper'lar async'tir. (.ts dosyasında JSX kullanmamak için React.createElement
 * tercih edildi.)
 */
import { createElement } from 'react';
import { render } from '@react-email/render';

import WelcomeEmail, {
  subject as welcomeSubject,
  WelcomeEmailProps,
} from './WelcomeEmail';
import VerifyEmail, {
  subject as verifySubject,
  VerifyEmailProps,
} from './VerifyEmail';
import PasswordResetEmail, {
  subject as passwordResetSubject,
  PasswordResetEmailProps,
} from './PasswordResetEmail';
import PasswordChangedEmail, {
  subject as passwordChangedSubject,
  PasswordChangedEmailProps,
} from './PasswordChangedEmail';
import EmailChangeConfirmEmail, {
  subject as emailChangeSubject,
  EmailChangeConfirmEmailProps,
} from './EmailChangeConfirmEmail';
import AccountSuspendedEmail, {
  subject as suspendedSubject,
  AccountSuspendedEmailProps,
} from './AccountSuspendedEmail';
import AccountBannedEmail, {
  subject as bannedSubject,
  AccountBannedEmailProps,
} from './AccountBannedEmail';
import ReportReviewedEmail, {
  subject as reportSubject,
  ReportReviewedEmailProps,
} from './ReportReviewedEmail';
import TransferAlertEmail, {
  subject as transferSubject,
  TransferAlertEmailProps,
} from './TransferAlertEmail';
import EngagementDigestEmail, {
  subject as engagementSubject,
  EngagementDigestEmailProps,
} from './EngagementDigestEmail';
import WeeklyDigestEmail, {
  subject as weeklySubject,
  WeeklyDigestEmailProps,
} from './WeeklyDigestEmail';
import BroadcastEmail, {
  subject as broadcastSubject,
  BroadcastEmailProps,
} from './BroadcastEmail';

export interface RenderedEmail {
  subject: string;
  html: string;
  /** Çoklu-parça (multipart) gönderim için düz metin alternatifi — spam skorunu düşürür. */
  text: string;
}

/**
 * Bir template'i tek seferde hem HTML hem düz metin olarak render eder.
 * Aynı element iki kez render edilir (HTML + plainText); multipart e-posta
 * deliverability'i (Gmail/Outlook spam filtreleri) belirgin iyileştirir.
 */
async function renderEmail(
  element: ReturnType<typeof createElement>,
  subject: string,
): Promise<RenderedEmail> {
  const [html, text] = await Promise.all([
    render(element, { pretty: false }),
    render(element, { pretty: false, plainText: true }),
  ]);
  return { subject, html, text };
}

export async function renderWelcomeEmail(
  props: WelcomeEmailProps,
): Promise<RenderedEmail> {
  return renderEmail(createElement(WelcomeEmail, props), welcomeSubject);
}

export async function renderVerifyEmail(
  props: VerifyEmailProps,
): Promise<RenderedEmail> {
  return renderEmail(createElement(VerifyEmail, props), verifySubject);
}

export async function renderPasswordResetEmail(
  props: PasswordResetEmailProps,
): Promise<RenderedEmail> {
  return renderEmail(
    createElement(PasswordResetEmail, props),
    passwordResetSubject,
  );
}

export async function renderPasswordChangedEmail(
  props: PasswordChangedEmailProps,
): Promise<RenderedEmail> {
  return renderEmail(
    createElement(PasswordChangedEmail, props),
    passwordChangedSubject,
  );
}

export async function renderEmailChangeConfirmEmail(
  props: EmailChangeConfirmEmailProps,
): Promise<RenderedEmail> {
  return renderEmail(
    createElement(EmailChangeConfirmEmail, props),
    emailChangeSubject,
  );
}

export async function renderAccountSuspendedEmail(
  props: AccountSuspendedEmailProps,
): Promise<RenderedEmail> {
  return renderEmail(
    createElement(AccountSuspendedEmail, props),
    suspendedSubject,
  );
}

export async function renderAccountBannedEmail(
  props: AccountBannedEmailProps,
): Promise<RenderedEmail> {
  return renderEmail(createElement(AccountBannedEmail, props), bannedSubject);
}

export async function renderReportReviewedEmail(
  props: ReportReviewedEmailProps,
): Promise<RenderedEmail> {
  return renderEmail(createElement(ReportReviewedEmail, props), reportSubject);
}

export async function renderTransferAlertEmail(
  props: TransferAlertEmailProps,
): Promise<RenderedEmail> {
  return renderEmail(createElement(TransferAlertEmail, props), transferSubject);
}

export async function renderEngagementDigestEmail(
  props: EngagementDigestEmailProps,
): Promise<RenderedEmail> {
  return renderEmail(
    createElement(EngagementDigestEmail, props),
    engagementSubject,
  );
}

export async function renderWeeklyDigestEmail(
  props: WeeklyDigestEmailProps,
): Promise<RenderedEmail> {
  return renderEmail(createElement(WeeklyDigestEmail, props), weeklySubject);
}

export async function renderBroadcastEmail(
  props: BroadcastEmailProps,
): Promise<RenderedEmail> {
  // Broadcast konusu admin tarafından title ile override edilebilir.
  return renderEmail(
    createElement(BroadcastEmail, props),
    props.title || broadcastSubject,
  );
}

// Template'leri ve prop tiplerini tek noktadan dışa aktar.
export { default as WelcomeEmail } from './WelcomeEmail';
export { default as VerifyEmail } from './VerifyEmail';
export { default as PasswordResetEmail } from './PasswordResetEmail';
export { default as PasswordChangedEmail } from './PasswordChangedEmail';
export { default as EmailChangeConfirmEmail } from './EmailChangeConfirmEmail';
export { default as AccountSuspendedEmail } from './AccountSuspendedEmail';
export { default as AccountBannedEmail } from './AccountBannedEmail';
export { default as ReportReviewedEmail } from './ReportReviewedEmail';
export { default as TransferAlertEmail } from './TransferAlertEmail';
export { default as EngagementDigestEmail } from './EngagementDigestEmail';
export { default as WeeklyDigestEmail } from './WeeklyDigestEmail';
export { default as BroadcastEmail } from './BroadcastEmail';

export type {
  WelcomeEmailProps,
  VerifyEmailProps,
  PasswordResetEmailProps,
  PasswordChangedEmailProps,
  EmailChangeConfirmEmailProps,
  AccountSuspendedEmailProps,
  AccountBannedEmailProps,
  ReportReviewedEmailProps,
  TransferAlertEmailProps,
  EngagementDigestEmailProps,
  WeeklyDigestEmailProps,
  BroadcastEmailProps,
};
export type { TransferAlertItem, TransferStatus } from './TransferAlertEmail';
export type {
  DigestNotification,
  NotificationType,
} from './EngagementDigestEmail';
export type { WeeklyTopTransfer } from './WeeklyDigestEmail';
export type { ReportOutcome } from './ReportReviewedEmail';
