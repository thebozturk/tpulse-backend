import * as React from 'react';
import WeeklyDigestEmail from '../WeeklyDigestEmail';
import { weeklyProps } from './_samples';

/** react-email dev server önizlemesi — örnek prop'larla. */
export default function WeeklyDigestEmailPreview() {
  return <WeeklyDigestEmail {...weeklyProps} />;
}
