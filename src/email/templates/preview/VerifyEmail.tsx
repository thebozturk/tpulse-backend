import * as React from 'react';
import VerifyEmail from '../VerifyEmail';
import { verifyProps } from './_samples';

/** react-email dev server önizlemesi — örnek prop'larla. */
export default function VerifyEmailPreview() {
  return <VerifyEmail {...verifyProps} />;
}
