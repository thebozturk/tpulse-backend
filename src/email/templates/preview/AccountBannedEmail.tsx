import * as React from 'react';
import AccountBannedEmail from '../AccountBannedEmail';
import { bannedProps } from './_samples';

/** react-email dev server önizlemesi — örnek prop'larla. */
export default function AccountBannedEmailPreview() {
  return <AccountBannedEmail {...bannedProps} />;
}
