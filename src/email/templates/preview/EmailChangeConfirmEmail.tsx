import * as React from 'react';
import EmailChangeConfirmEmail from '../EmailChangeConfirmEmail';
import { emailChangeProps } from './_samples';

/** react-email dev server önizlemesi — örnek prop'larla. */
export default function EmailChangeConfirmEmailPreview() {
  return <EmailChangeConfirmEmail {...emailChangeProps} />;
}
