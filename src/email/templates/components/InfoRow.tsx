import * as React from 'react';
import { Row, Column, Text } from '@react-email/components';
import { colors, fontStacks } from './theme';

export interface InfoRowProps {
  label: string;
  value: React.ReactNode;
  /** value rengini değiştir (ör. tutar için lime/success). */
  valueColor?: string;
  /** Son satırda alt çizgi gösterme. */
  last?: boolean;
}

/** "Tutar: 26M €" gibi etiket/değer satırı. */
export function InfoRow({ label, value, valueColor, last }: InfoRowProps) {
  return (
    <Row
      style={{
        borderBottom: last ? 'none' : `1px solid ${colors.border}`,
      }}
    >
      <Column style={{ padding: '10px 0' }}>
        <Text
          style={{
            margin: 0,
            fontFamily: fontStacks.body,
            fontSize: '13px',
            color: colors.muted,
          }}
        >
          {label}
        </Text>
      </Column>
      <Column style={{ padding: '10px 0', textAlign: 'right' }}>
        <Text
          style={{
            margin: 0,
            fontFamily: fontStacks.body,
            fontSize: '14px',
            fontWeight: 600,
            color: valueColor ?? colors.text,
          }}
        >
          {value}
        </Text>
      </Column>
    </Row>
  );
}

export default InfoRow;
