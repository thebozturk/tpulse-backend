import * as React from 'react';
import AccountSuspendedEmail from '../AccountSuspendedEmail';
import { suspendedProps } from './_samples';

/** react-email dev server önizlemesi — örnek prop'larla. */
export default function AccountSuspendedEmailPreview() {
  return <AccountSuspendedEmail {...suspendedProps} />;
}
