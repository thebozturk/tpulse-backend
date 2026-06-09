import * as React from 'react';
import PasswordChangedEmail from '../PasswordChangedEmail';
import { passwordChangedProps } from './_samples';

/** react-email dev server önizlemesi — örnek prop'larla. */
export default function PasswordChangedEmailPreview() {
  return <PasswordChangedEmail {...passwordChangedProps} />;
}
