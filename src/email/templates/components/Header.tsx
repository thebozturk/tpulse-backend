import * as React from 'react';
import { Section, Row, Column, Img } from '@react-email/components';
import { colors, radius, fontStacks } from './theme';

export interface HeaderProps {
  assetBaseUrl: string;
  /** "● CANLI" lime pill göster. */
  live?: boolean;
}

/**
 * Marka header'ı: PNG logo (Gmail SVG'yi bloklar → @2x PNG, absolute URL)
 * + opsiyonel canlı yayın rozeti.
 */
export function Header({ assetBaseUrl, live }: HeaderProps) {
  return (
    <Section style={{ padding: '4px 0 24px' }}>
      <Row>
        <Column>
          <Img
            src={`${assetBaseUrl}/dark-mode-horizontal.png`}
            width="180"
            height="28"
            alt="TransferPulse"
            style={{ display: 'block', border: 'none', outline: 'none' }}
          />
        </Column>
        {live ? (
          <Column style={{ textAlign: 'right' }}>
            <span
              style={{
                display: 'inline-block',
                whiteSpace: 'nowrap',
                backgroundColor: colors.lime,
                color: colors.limeText,
                fontFamily: fontStacks.body,
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                lineHeight: '1',
                padding: '7px 12px',
                borderRadius: radius.pill,
              }}
            >
              <span style={{ marginRight: '6px' }}>●</span>CANLI
            </span>
          </Column>
        ) : null}
      </Row>
    </Section>
  );
}

export default Header;
