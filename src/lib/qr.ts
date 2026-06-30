import QRCode from "qrcode"

/**
 * Generates a QR code as a data URL (PNG) pointing to the event's public
 * join page. Used server-side for event management dashboards.
 */
export async function generateEventQr(slug: string): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const url = `${baseUrl}/event/${slug}`

  return QRCode.toDataURL(url, {
    width: 512,
    margin: 2,
    color: {
      dark: "#1e1b4b", // indigo-950
      light: "#ffffff",
    },
    errorCorrectionLevel: "M",
  })
}

export function eventJoinUrl(slug: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  return `${baseUrl}/event/${slug}`
}
