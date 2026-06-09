import * as React from 'react';
import EngagementDigestEmail from '../EngagementDigestEmail';
import { engagementProps } from './_samples';

/** react-email dev server önizlemesi — örnek prop'larla. */
export default function EngagementDigestEmailPreview() {
  return <EngagementDigestEmail {...engagementProps} />;
}
