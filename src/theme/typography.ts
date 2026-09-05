/**
 * Font family names as registered by `useFonts()` in App.tsx (the object key becomes
 * the usable `fontFamily` string - see @expo-google-fonts/sora). Sora is used for
 * anything that should carry brand personality (headings, numbers, buttons); body copy
 * intentionally stays on the OS system font for maximum readability at small sizes.
 */
export const fonts = {
  regular: 'Sora_400Regular',
  semiBold: 'Sora_600SemiBold',
  bold: 'Sora_700Bold',
  extraBold: 'Sora_800ExtraBold',
} as const;
