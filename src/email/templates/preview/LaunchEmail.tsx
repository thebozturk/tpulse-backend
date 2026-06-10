import * as React from 'react';
import LaunchEmail from '../LaunchEmail';
import { launchProps } from './_samples';

/** react-email dev server önizlemesi — örnek prop'larla. */
export default function LaunchEmailPreview() {
  return <LaunchEmail {...launchProps} />;
}
