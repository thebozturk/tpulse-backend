/**
 * TransferPulse e-posta tasarım token'ları — TEK KAYNAK.
 * Hem react-email <Tailwind> config'i hem de inline stil gereken yerler
 * (bazı email client'ları Tailwind class'larını desteklemez) bu dosyadan beslenir.
 */

export const colors = {
  bg: '#0A0A0A',
  surface: '#141414',
  elevated: '#1C1C1C',
  border: '#262626',
  lime: '#C6F135',
  limeText: '#0A0A0A',
  text: '#FFFFFF',
  muted: '#A1A1A1',
  success: '#3DD68C',
  warning: '#F5A623',
  danger: '#F7554F',
} as const;

export const radius = {
  card: '14px',
  button: '10px',
  pill: '999px',
} as const;

export const fontStacks = {
  heading: "'Archivo', 'Arial Black', Arial, sans-serif",
  body: "'Inter', Helvetica, Arial, sans-serif",
} as const;

export const spacing = {
  page: '24px',
  card: '20px',
  gap: '16px',
} as const;

/** Google Font web font ayarları — <Font> component'i için. */
export const webFonts = {
  heading: {
    fontFamily: 'Archivo',
    fallback: 'Arial' as const,
    // Archivo Expanded benzeri sıkışık/ağır görünüm için yüksek weight.
    url: 'https://fonts.gstatic.com/s/archivo/v19/k3kQo8UDI-1M0wlSV9XAw6lQkqWY8Q82sJaRE-NWIDdgffTTNDNZ9xdp.woff2',
    weight: 800,
    format: 'woff2' as const,
  },
  body: {
    fontFamily: 'Inter',
    fallback: 'Helvetica' as const,
    url: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.woff2',
    weight: 400,
    format: 'woff2' as const,
  },
} as const;

/**
 * react-email <Tailwind config={tailwindConfig}> ile kullanılır.
 * Marka token'larının tamamı theme.extend altında.
 */
export const tailwindConfig = {
  theme: {
    extend: {
      colors: {
        bg: colors.bg,
        surface: colors.surface,
        elevated: colors.elevated,
        border: colors.border,
        lime: colors.lime,
        limeText: colors.limeText,
        text: colors.text,
        muted: colors.muted,
        success: colors.success,
        warning: colors.warning,
        danger: colors.danger,
      },
      borderRadius: {
        card: radius.card,
        btn: radius.button,
        pill: radius.pill,
      },
      fontFamily: {
        heading: ['Archivo', 'Arial Black', 'Arial', 'sans-serif'],
        body: ['Inter', 'Helvetica', 'Arial', 'sans-serif'],
      },
      maxWidth: {
        email: '600px',
      },
    },
  },
} as const;

export const BRAND = {
  name: 'TransferPulse',
  wordmarkA: 'TRANSFER',
  wordmarkB: 'PULSE',
  address:
    'TransferPulse Teknoloji A.Ş. · Maslak Mah. · 34485 İstanbul, Türkiye',
  supportEmail: 'destek@transferpulse.app',
} as const;
