import * as React from 'react';
import TransferAlertEmail from '../TransferAlertEmail';
import { transferAlertProps } from './_samples';

/** react-email dev server önizlemesi — örnek prop'larla. */
export default function TransferAlertEmailPreview() {
  return <TransferAlertEmail {...transferAlertProps} />;
}
