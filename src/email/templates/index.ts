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
}

const RENDER_OPTIONS = { pretty: false } as const;

export async function renderWelcomeEmail(
  props: WelcomeEmailProps,
): Promise<RenderedEmail> {
  return {
    subject: welcomeSubject,
    html: await render(createElement(WelcomeEmail, props), RENDER_OPTIONS),
  };
}

export async function renderVerifyEmail(
  props: VerifyEmailProps,
): Promise<RenderedEmail> {
  return {
    subject: verifySubject,
    html: await render(createElement(VerifyEmail, props), RENDER_OPTIONS),
  };
}

export async function renderPasswordResetEmail(
  props: PasswordResetEmailProps,
): Promise<RenderedEmail> {
  return {
    subject: passwordResetSubject,
    html: await render(
      createElement(PasswordResetEmail, props),
      RENDER_OPTIONS,
    ),
  };
}

export async function renderPasswordChangedEmail(
  props: PasswordChangedEmailProps,
): Promise<RenderedEmail> {
  return {
    subject: passwordChangedSubject,
    html: await render(
      createElement(PasswordChangedEmail, props),
      RENDER_OPTIONS,
    ),
  };
}

export async function renderEmailChangeConfirmEmail(
  props: EmailChangeConfirmEmailProps,
): Promise<RenderedEmail> {
  return {
    subject: emailChangeSubject,
    html: await render(
      createElement(EmailChangeConfirmEmail, props),
      RENDER_OPTIONS,
    ),
  };
}

export async function renderAccountSuspendedEmail(
  props: AccountSuspendedEmailProps,
): Promise<RenderedEmail> {
  return {
    subject: suspendedSubject,
    html: await render(
      createElement(AccountSuspendedEmail, props),
      RENDER_OPTIONS,
    ),
  };
}

export async function renderAccountBannedEmail(
  props: AccountBannedEmailProps,
): Promise<RenderedEmail> {
  return {
    subject: bannedSubject,
    html: await render(
      createElement(AccountBannedEmail, props),
      RENDER_OPTIONS,
    ),
  };
}

export async function renderReportReviewedEmail(
  props: ReportReviewedEmailProps,
): Promise<RenderedEmail> {
  return {
    subject: reportSubject,
    html: await render(
      createElement(ReportReviewedEmail, props),
      RENDER_OPTIONS,
    ),
  };
}

export async function renderTransferAlertEmail(
  props: TransferAlertEmailProps,
): Promise<RenderedEmail> {
  return {
    subject: transferSubject,
    html: await render(
      createElement(TransferAlertEmail, props),
      RENDER_OPTIONS,
    ),
  };
}

export async function renderEngagementDigestEmail(
  props: EngagementDigestEmailProps,
): Promise<RenderedEmail> {
  return {
    subject: engagementSubject,
    html: await render(
      createElement(EngagementDigestEmail, props),
      RENDER_OPTIONS,
    ),
  };
}

export async function renderWeeklyDigestEmail(
  props: WeeklyDigestEmailProps,
): Promise<RenderedEmail> {
  return {
    subject: weeklySubject,
    html: await render(createElement(WeeklyDigestEmail, props), RENDER_OPTIONS),
  };
}

export async function renderBroadcastEmail(
  props: BroadcastEmailProps,
): Promise<RenderedEmail> {
  // Broadcast konusu admin tarafından title ile override edilebilir.
  return {
    subject: props.title || broadcastSubject,
    html: await render(createElement(BroadcastEmail, props), RENDER_OPTIONS),
  };
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
