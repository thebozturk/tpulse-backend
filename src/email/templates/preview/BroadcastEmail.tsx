import * as React from 'react';
import BroadcastEmail from '../BroadcastEmail';
import { broadcastProps } from './_samples';

/** react-email dev server önizlemesi — örnek prop'larla. */
export default function BroadcastEmailPreview() {
  return <BroadcastEmail {...broadcastProps} />;
}
