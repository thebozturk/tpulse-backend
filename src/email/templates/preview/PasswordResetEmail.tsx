import * as React from 'react';
import PasswordResetEmail from '../PasswordResetEmail';
import { passwordResetProps } from './_samples';

/** react-email dev server önizlemesi — örnek prop'larla. */
export default function PasswordResetEmailPreview() {
  return <PasswordResetEmail {...passwordResetProps} />;
}
