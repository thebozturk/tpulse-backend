import * as React from 'react';
import WelcomeEmail from '../WelcomeEmail';
import { welcomeProps } from './_samples';

/** react-email dev server önizlemesi — örnek prop'larla. */
export default function WelcomeEmailPreview() {
  return <WelcomeEmail {...welcomeProps} />;
}
