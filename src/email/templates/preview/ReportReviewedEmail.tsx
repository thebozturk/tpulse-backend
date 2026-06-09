import * as React from 'react';
import ReportReviewedEmail from '../ReportReviewedEmail';
import { reportUpheldProps } from './_samples';

/** react-email dev server önizlemesi — örnek prop'larla. */
export default function ReportReviewedEmailPreview() {
  return <ReportReviewedEmail {...reportUpheldProps} />;
}
