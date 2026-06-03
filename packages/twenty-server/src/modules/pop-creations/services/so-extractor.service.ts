import { Injectable, Logger } from '@nestjs/common';

/**
 * Patterns that match Sales Order numbers.
 */
const SO_PATTERNS: RegExp[] = [
  // "SO #1234567" / "SO# 1234567" / "SO 1234567" / "SO-1234567"
  /\bSO[\s#\-]?(\d{5,12})\b/gi,
  // "Sales Order #1234567" / "Sales Order: 1234567"
  /\bSales\s+Order[\s:#\-]*(\d{5,12})\b/gi,
  // "Order #1234567" (only if followed by enough digits to be an order number)
  /\bOrder\s*[:#]?\s*(\d{6,12})\b/gi,
];

/**
 * Patterns that match Purchase Order / Production PO numbers.
 */
const PO_PATTERNS: RegExp[] = [
  // "PO #1234567" / "PO# 1234567" / "PO 1234567" / "PO-1234567"
  /\bPO[\s#\-]?(\d{5,12})\b/gi,
  // "Purchase Order #1234567" / "Purchase Order: 1234567"
  /\bPurchase\s+Order[\s:#\-]*(\d{5,12})\b/gi,
];

/** Combined default patterns (used by legacy extract() method). */
const DEFAULT_PATTERNS: RegExp[] = [...SO_PATTERNS, ...PO_PATTERNS];

/**
 * Extracts Sales Order and Purchase Order numbers from an email body.
 *
 * Two-layer approach:
 * 1. Default patterns are always applied (catch the most common formats).
 * 2. Company-specific patterns (stored in Company.soPatterns, newline-delimited regex)
 *    are compiled and applied in addition to defaults.
 *
 * Returns a deduplicated, uppercased array of matched number strings.
 * Returns an empty array if nothing is found.
 */
@Injectable()
export class SoExtractorService {
  private readonly logger = new Logger(SoExtractorService.name);

  /**
   * Extract SO/PO numbers from the given text.
   *
   * @param text - email body (plain text)
   * @param companyPatterns - value of Company.soPatterns for the matched company
   *   (newline-delimited regex strings, optional)
   */
  extract(text: string, companyPatterns?: string | null): string[] {
    if (!text) return [];

    const patterns = [...DEFAULT_PATTERNS];

    if (companyPatterns) {
      for (const line of companyPatterns.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        try {
          patterns.push(new RegExp(trimmed, 'gi'));
        } catch {
          this.logger.warn(`Invalid SO pattern regex: "${trimmed}"`);
        }
      }
    }

    const found = new Set<string>();

    for (const pattern of patterns) {
      pattern.lastIndex = 0; // reset stateful global regex
      let match: RegExpExecArray | null;

      while ((match = pattern.exec(text)) !== null) {
        const value = (match[1] ?? match[0]).trim().toUpperCase();
        if (value) found.add(value);
      }
    }

    return Array.from(found);
  }

  /**
   * Convenience wrapper — returns a comma-delimited string suitable for
   * storing in EmailMessage.detectedSoNumbers, or null if nothing found.
   */
  extractAsString(
    text: string,
    companyPatterns?: string | null,
  ): string | null {
    const numbers = this.extract(text, companyPatterns);
    return numbers.length > 0 ? numbers.join(', ') : null;
  }

  /**
   * Extract SO and PO numbers separately.
   * Returns { soNumbers, poNumbers } as comma-delimited strings (or null).
   */
  extractSeparate(
    text: string,
    companyPatterns?: string | null,
  ): { soNumbers: string | null; poNumbers: string | null } {
    if (!text) return { soNumbers: null, poNumbers: null };

    const soPatterns = [...SO_PATTERNS];
    const poPatterns = [...PO_PATTERNS];

    if (companyPatterns) {
      for (const line of companyPatterns.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        try {
          // Company-specific patterns go into both buckets
          soPatterns.push(new RegExp(trimmed, 'gi'));
          poPatterns.push(new RegExp(trimmed, 'gi'));
        } catch {
          this.logger.warn(`Invalid SO pattern regex: "${trimmed}"`);
        }
      }
    }

    const runPatterns = (patterns: RegExp[]): string | null => {
      const found = new Set<string>();

      for (const pattern of patterns) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = pattern.exec(text)) !== null) {
          const value = (match[1] ?? match[0]).trim().toUpperCase();
          if (value) found.add(value);
        }
      }
      return found.size > 0 ? Array.from(found).join(', ') : null;
    };

    return {
      soNumbers: runPatterns(soPatterns),
      poNumbers: runPatterns(poPatterns),
    };
  }
}
