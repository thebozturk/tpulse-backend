import * as React from 'react';
import {
  Html,
  Head,
  Font,
  Preview,
  Body,
  Container,
  Tailwind,
} from '@react-email/components';
import { colors, fontStacks, spacing, webFonts, tailwindConfig } from './theme';
import { Header } from './Header';
import { Footer } from './Footer';

export interface EmailLayoutProps {
  /** Gelen kutusu önizleme satırı (anlamlı olmalı). */
  preview: string;
  assetBaseUrl: string;
  unsubscribeUrl: string;
  /** "Bu e-postayı X nedeniyle aldınız" açıklaması. */
  reason?: string;
  /** Header'da "● CANLI" rozeti göster. */
  live?: boolean;
  children: React.ReactNode;
}

const DEFAULT_REASON =
  'Bu e-postayı TransferPulse hesabınla ilgili olduğu için aldın.';

/**
 * Tüm template'lerin ortak sarmalayıcısı:
 * Html → Head(+Font) → Tailwind → Preview → Body(koyu) → Container(600px)
 * → Header + içerik + Footer.
 */
export function EmailLayout({
  preview,
  assetBaseUrl,
  unsubscribeUrl,
  reason = DEFAULT_REASON,
  live,
  children,
}: EmailLayoutProps) {
  return (
    <Html lang="tr" dir="ltr">
      <Head>
        <meta name="color-scheme" content="dark" />
        <meta name="supported-color-schemes" content="dark" />
        <Font
          fontFamily={webFonts.heading.fontFamily}
          fallbackFontFamily={webFonts.heading.fallback}
          webFont={{ url: webFonts.heading.url, format: webFonts.heading.format }}
          fontWeight={webFonts.heading.weight}
          fontStyle="normal"
        />
        <Font
          fontFamily={webFonts.body.fontFamily}
          fallbackFontFamily={webFonts.body.fallback}
          webFont={{ url: webFonts.body.url, format: webFonts.body.format }}
          fontWeight={webFonts.body.weight}
          fontStyle="normal"
        />
      </Head>
      <Tailwind config={tailwindConfig}>
        <Preview>{preview}</Preview>
        <Body
          style={{
            backgroundColor: colors.bg,
            color: colors.text,
            fontFamily: fontStacks.body,
            margin: 0,
            padding: 0,
            WebkitTextSizeAdjust: '100%',
          }}
        >
          <Container
            style={{
              maxWidth: '600px',
              width: '100%',
              margin: '0 auto',
              padding: `${spacing.page} ${spacing.page} 32px`,
            }}
          >
            <Header assetBaseUrl={assetBaseUrl} live={live} />
            {children}
            <Footer unsubscribeUrl={unsubscribeUrl} reason={reason} />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export default EmailLayout;
