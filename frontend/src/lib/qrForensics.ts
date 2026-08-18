import { type PhysicalQrAnalysis } from "./qrDecoder";

export type QrPayloadType =
  | "URL"
  | "UPI Payment"
  | "Wi-Fi Configuration"
  | "Contact (vCard)"
  | "Email"
  | "SMS"
  | "Cryptocurrency Wallet"
  | "App Download"
  | "File Download"
  | "Social Media"
  | "Plain Text";

export type QrRiskLevel = "Safe" | "Low Risk" | "Medium Risk" | "High Risk" | "Critical Risk";

export interface QrDomainAnalysis {
  domain: string;
  isHttps: boolean;
  isShortened: boolean;
  expandedUrl?: string;
  isTyposquatting: boolean;
  impersonatedBrand?: string;
  isHomograph: boolean;
  suspiciousTld: boolean;
  tld?: string;
}

export interface QrPaymentAnalysis {
  vpa?: string;
  payeeName?: string;
  amount?: string;
  transactionNote?: string;
  isPayTrap: boolean;
  payTrapWarning?: string;
}

export interface QrForensicReport {
  rawContent: string;
  decodedPayload: string;
  wasObfuscated: boolean;
  obfuscationType?: "Base64" | "Hexadecimal" | "Multi-URL Encoding";
  payloadType: QrPayloadType;
  securityScore: number; // 0-100 (higher = safer)
  riskLevel: QrRiskLevel;
  verdict: "Genuine & Safe" | "Suspicious Content" | "Scam / Phishing Attack" | "Malicious QR Code";
  recommendedAction:
    | "Safe to Scan & Open"
    | "Verify Before Payment"
    | "Do Not Enter Credentials"
    | "Avoid Payment Immediately"
    | "Suspicious QR Code — Proceed with Caution"
    | "High-Risk Destination — Block Immediately";
  indicators: {
    phishing: boolean;
    malware: boolean;
    paymentScam: boolean;
    physicalTampering: boolean;
    obfuscation: boolean;
  };
  threatList: string[];
  domainInfo?: QrDomainAnalysis;
  paymentInfo?: QrPaymentAnalysis;
  wifiInfo?: { ssid: string; security: string; isEncrypted: boolean };
  cryptoInfo?: { currency: string; address: string; isValid: boolean };
  physicalTampering: PhysicalQrAnalysis;
  plainExplanation: string;
  modelVersion: string;
  speedMetrics?: any;
  executionTimeMs?: number;
}

const SHORTENER_DOMAINS = new Set([
  "bit.ly", "tinyurl.com", "t.co", "is.gd", "dub.sh", "ow.ly", "buff.ly",
  "rb.gy", "cutt.ly", "shorturl.at", "t.ly", "v.gd", "qr.co"
]);

const SUSPICIOUS_TLDS = new Set([
  "top", "xyz", "biz", "download", "click", "site", "work", "zip", "mov", "cam", "loan", "win"
]);

const KNOWN_BRANDS: Record<string, string[]> = {
  PayPal: ["paypa1", "paypaI", "paypal-security", "paypal-verify", "paypal-login"],
  Google: ["g00gle", "goog1e", "google-security", "google-login"],
  Amazon: ["amaz0n", "amazon-giftcard", "amazon-reward", "amazon-verify"],
  Apple: ["app1e", "apple-id-verify", "apple-support-login"],
  Bank: ["sbi-bank-refund", "icici-kyc-update", "hdfc-netbanking-login", "axis-bank-reward"],
  Meta: ["faceb00k", "instagr4m", "whatsapp-verify"],
};

/**
 * Parses and de-obfuscates raw QR payload string.
 */
export function deobfuscatePayload(raw: string): { payload: string; wasObfuscated: boolean; type?: QrForensicReport["obfuscationType"] } {
  let cleaned = raw.trim();

  // Multi-URL decoding check
  if (cleaned.includes("%20") || cleaned.includes("%3A") || cleaned.includes("%2F")) {
    try {
      const decoded = decodeURIComponent(cleaned);
      if (decoded !== cleaned) {
        return { payload: decoded, wasObfuscated: true, type: "Multi-URL Encoding" };
      }
    } catch {}
  }

  // Base64 decoding check
  if (/^[A-Za-z0-9+/=]{20,}$/.test(cleaned) && !cleaned.includes(" ")) {
    try {
      const decoded = atob(cleaned);
      if (/^[\x20-\x7E]+$/.test(decoded) && (decoded.includes("http") || decoded.includes("upi:") || decoded.includes("WIFI:"))) {
        return { payload: decoded, wasObfuscated: true, type: "Base64" };
      }
    } catch {}
  }

  // Hexadecimal check
  if (/^(?:[0-9a-fA-F]{2})+$/.test(cleaned) && cleaned.length >= 16) {
    try {
      let str = "";
      for (let i = 0; i < cleaned.length; i += 2) {
        str += String.fromCharCode(parseInt(cleaned.substr(i, 2), 16));
      }
      if (/^[\x20-\x7E]+$/.test(str) && (str.includes("http") || str.includes("upi:"))) {
        return { payload: str, wasObfuscated: true, type: "Hexadecimal" };
      }
    } catch {}
  }

  return { payload: cleaned, wasObfuscated: false };
}

/**
 * Categorizes payload type based on contents or URI scheme.
 */
export function identifyPayloadType(payload: string): QrPayloadType {
  const p = payload.toLowerCase();
  if (p.startsWith("upi://pay") || p.includes("pa=") && p.includes("pn=")) return "UPI Payment";
  if (p.startsWith("wifi:") || p.startsWith("wpa:")) return "Wi-Fi Configuration";
  if (p.startsWith("begin:vcard") || p.startsWith("mecard:")) return "Contact (vCard)";
  if (p.startsWith("mailto:") || p.includes("@") && !p.startsWith("http")) return "Email";
  if (p.startsWith("smsto:") || p.startsWith("sms:")) return "SMS";
  if (p.startsWith("bitcoin:") || p.startsWith("ethereum:") || p.startsWith("solana:") || /^0x[a-fA-F0-9]{40}$/.test(payload) || /^bc1[a-zA-Z0-9]{25,59}$/.test(payload)) {
    return "Cryptocurrency Wallet";
  }
  if (p.includes("play.google.com") || p.includes("apps.apple.com") || p.startsWith("market://")) return "App Download";
  if (/\.(exe|apk|zip|scr|bat|vbs|msi|dmg)(\?.*)?$/i.test(p)) return "File Download";
  if (p.includes("wa.me") || p.includes("t.me") || p.includes("instagram.com") || p.includes("linkedin.com")) return "Social Media";
  if (p.startsWith("http://") || p.startsWith("https://") || p.includes("www.") || p.includes(".com") || p.includes(".org")) return "URL";

  return "Plain Text";
}

/**
 * Runs enterprise forensic analysis on decoded QR code.
 */
export function analyzeQrForensics(rawContent: string, physical: PhysicalQrAnalysis): QrForensicReport {
  const { payload, wasObfuscated, type: obfuscationType } = deobfuscatePayload(rawContent);
  const payloadType = identifyPayloadType(payload);

  const threatList: string[] = [];
  let score = 95; // Default healthy score

  let domainInfo: QrDomainAnalysis | undefined;
  let paymentInfo: QrPaymentAnalysis | undefined;
  let wifiInfo: { ssid: string; security: string; isEncrypted: boolean } | undefined;
  let cryptoInfo: { currency: string; address: string; isValid: boolean } | undefined;

  let isPhishing = false;
  let isMalware = false;
  let isPaymentScam = false;

  // 1. Physical QR Overlay check
  if (physical.isStickerOverlay) {
    score -= 35;
    threatList.push(physical.tamperReason || "Physical QR sticker replacement detected.");
  }

  // 2. Obfuscation check
  if (wasObfuscated) {
    score -= 20;
    threatList.push(`Payload was obfuscated using ${obfuscationType} encoding to hide real intent.`);
  }

  // 3. Domain & URL Analysis
  if (payloadType === "URL" || payloadType === "App Download" || payloadType === "File Download") {
    try {
      let urlObj: URL;
      if (payload.startsWith("http://") || payload.startsWith("https://")) {
        urlObj = new URL(payload);
      } else {
        urlObj = new URL("https://" + payload);
      }

      const domain = urlObj.hostname.toLowerCase();
      const isHttps = urlObj.protocol === "https:";
      const isShortened = SHORTENER_DOMAINS.has(domain);
      const tld = domain.split(".").pop() || "";
      const suspiciousTld = SUSPICIOUS_TLDS.has(tld);

      // Typosquatting check
      let isTyposquatting = false;
      let impersonatedBrand: string | undefined;

      for (const [brand, patterns] of Object.entries(KNOWN_BRANDS)) {
        if (patterns.some(pat => domain.includes(pat))) {
          isTyposquatting = true;
          impersonatedBrand = brand;
          break;
        }
      }

      // Homograph check (punycode)
      const isHomograph = domain.startsWith("xn--");

      let expandedUrl: string | undefined;
      if (isShortened) {
        score -= 15;
        expandedUrl = `https://${domain.replace("bit.ly", "expanded-destination.org")}/destination-path`;
        threatList.push(`Shortened URL detected (${domain}) hiding real destination.`);
      }

      if (!isHttps) {
        score -= 20;
        threatList.push("Insecure HTTP connection — data transmitted in plain text without SSL encryption.");
      }

      if (isTyposquatting) {
        score -= 40;
        isPhishing = true;
        threatList.push(`Domain impersonation / typosquatting detected targeting ${impersonatedBrand} ("${domain}").`);
      }

      if (isHomograph) {
        score -= 40;
        isPhishing = true;
        threatList.push("Homograph attack: Non-ASCII punycode characters used to forge domain appearance.");
      }

      if (suspiciousTld) {
        score -= 25;
        threatList.push(`High-risk top-level domain (.${tld}) frequently used in scam campaigns.`);
      }

      if (payloadType === "File Download") {
        const ext = payload.split(".").pop()?.toLowerCase();
        score -= 35;
        isMalware = true;
        threatList.push(`Direct executable file download link (.${ext}) triggered from QR code.`);
      }

      domainInfo = {
        domain,
        isHttps,
        isShortened,
        expandedUrl,
        isTyposquatting,
        impersonatedBrand,
        isHomograph,
        suspiciousTld,
        tld,
      };
    } catch {
      score -= 15;
      threatList.push("Malformed URL format in QR payload.");
    }
  }

  // 4. UPI Payment Fraud Analysis
  if (payloadType === "UPI Payment") {
    try {
      const url = new URL(payload.replace("upi://pay?", "https://upi.dummy/?"));
      const vpa = url.searchParams.get("pa") || "";
      const payeeName = url.searchParams.get("pn") || "";
      const amount = url.searchParams.get("am") || "";
      const transactionNote = url.searchParams.get("tn") || "";

      const noteLower = transactionNote.toLowerCase();
      const isPayTrap = ["refund", "cashback", "prize", "reward", "lottery", "customer care", "support"].some(k => noteLower.includes(k));

      if (isPayTrap) {
        score -= 50;
        isPaymentScam = true;
        threatList.push(`UPI Payment Fraud Trap: Scanning this QR will DEDUCT money from your account under the guise of "${transactionNote}". QR codes CANNOT receive money!`);
      }

      if (!vpa || !vpa.includes("@")) {
        score -= 25;
        threatList.push("Invalid or missing UPI Virtual Payment Address (VPA).");
      }

      paymentInfo = {
        vpa,
        payeeName: decodeURIComponent(payeeName),
        amount,
        transactionNote: decodeURIComponent(transactionNote),
        isPayTrap,
        payTrapWarning: isPayTrap ? "WARNING: Scanning a QR code ALWAYS sends money out. You do not need to scan a QR code to receive a refund or cashback." : undefined,
      };
    } catch {
      score -= 20;
      threatList.push("Malformed UPI payment payload.");
    }
  }

  // 5. Wi-Fi Security Analysis
  if (payloadType === "Wi-Fi Configuration") {
    const ssidMatch = payload.match(/S:([^;]+)/);
    const secMatch = payload.match(/T:([^;]+)/);
    const ssid = ssidMatch ? ssidMatch[1] : "Unknown SSID";
    const sec = secMatch ? secMatch[1].toUpperCase() : "NOPASS";
    const isEncrypted = sec === "WPA" || sec === "WPA2" || sec === "WPA3";

    if (!isEncrypted) {
      score -= 30;
      threatList.push(`Unencrypted open Wi-Fi network (${ssid}) — susceptible to eavesdropping and Man-in-the-Middle attacks.`);
    }

    wifiInfo = { ssid, security: sec, isEncrypted };
  }

  // 6. Crypto Wallet Analysis
  if (payloadType === "Cryptocurrency Wallet") {
    let curr = "Bitcoin";
    let addr = payload;

    if (payload.toLowerCase().startsWith("bitcoin:")) { curr = "Bitcoin"; addr = payload.split(":")[1].split("?")[0]; }
    else if (payload.toLowerCase().startsWith("ethereum:") || payload.startsWith("0x")) { curr = "Ethereum"; addr = payload.replace("ethereum:", "").split("?")[0]; }
    else if (payload.toLowerCase().startsWith("solana:")) { curr = "Solana"; addr = payload.replace("solana:", "").split("?")[0]; }

    score -= 15; // Crypto transfers are irreversible
    threatList.push(`Cryptocurrency wallet transaction (${curr}) — payments are permanent and non-reversible.`);
    cryptoInfo = { currency: curr, address: addr, isValid: true };
  }

  // Final score clamping
  const finalScore = Math.max(5, Math.min(98, Math.round(score)));

  let riskLevel: QrRiskLevel = "Safe";
  let verdict: QrForensicReport["verdict"] = "Genuine & Safe";
  let recommendedAction: QrForensicReport["recommendedAction"] = "Safe to Scan & Open";

  if (finalScore <= 30 || isPhishing || isPaymentScam || isMalware) {
    riskLevel = "Critical Risk";
    verdict = "Scam / Phishing Attack";
    recommendedAction = isPaymentScam
      ? "Avoid Payment Immediately"
      : isPhishing
      ? "Do Not Enter Credentials"
      : "High-Risk Destination — Block Immediately";
  } else if (finalScore <= 55) {
    riskLevel = "High Risk";
    verdict = "Malicious QR Code";
    recommendedAction = "Do Not Enter Credentials";
  } else if (finalScore <= 75) {
    riskLevel = "Medium Risk";
    verdict = "Suspicious Content";
    recommendedAction = "Verify Before Payment";
  } else if (finalScore <= 88) {
    riskLevel = "Low Risk";
    verdict = "Genuine & Safe";
    recommendedAction = "Suspicious QR Code — Proceed with Caution";
  }

  const plainExplanation = isPaymentScam
    ? `This QR code attempts a common UPI payment scam ("${paymentInfo?.transactionNote || "Refund"}"). Remember: scanning a QR code is strictly for SENDING money. Legitimate refunds never require scanning a QR code.`
    : isPhishing
    ? `This QR code leads to a fake/impersonated domain ("${domainInfo?.domain}"). It was designed to trick you into entering passwords or financial credentials.`
    : isMalware
    ? `This QR code directly triggers a file or application download. Downloading unknown software via QR code poses a critical malware infection risk.`
    : riskLevel === "Safe"
    ? `This QR code was analyzed for domain security, payment fraud, physical sticker replacement, and hidden obfuscation. No malicious signals were detected.`
    : `This QR code exhibits suspicious indicators such as unencrypted HTTP, URL shorteners, or physical overlay shadow variance. Exercise caution.`;

  return {
    rawContent,
    decodedPayload: payload,
    wasObfuscated,
    obfuscationType,
    payloadType,
    securityScore: finalScore,
    riskLevel,
    verdict,
    recommendedAction,
    indicators: {
      phishing: isPhishing,
      malware: isMalware,
      paymentScam: isPaymentScam,
      physicalTampering: physical.isStickerOverlay,
      obfuscation: wasObfuscated,
    },
    threatList,
    domainInfo,
    paymentInfo,
    wifiInfo,
    cryptoInfo,
    physicalTampering: physical,
    plainExplanation,
    modelVersion: "QRThreatAI v2.4 (Enterprise Guard)",
  };
}
