/**
 * EmailRouterService
 *
 * Core routing pipeline for matching emails to Company, Department, and Program.
 *
 * Auto-skip — Filter noise (personal domains, no-reply, internal-only, vendor companies)
 * Step 1   — Domain → Company:  Extract external domains, look up customer companies
 * Step 2   — Department narrowing:  People on email scoped to a single department
 * Step 3   — SO/PO number matching:  Exact PO regex + SO from active opportunities
 * Step 4   — Fuzzy name matching:  Token overlap against opportunity/company names
 * Step 5   — AI matching:  Send to configured model with active opportunities list
 */

import { Injectable, Logger } from '@nestjs/common';

import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { type CompanyWorkspaceEntity } from 'src/modules/company/standard-objects/company.workspace-entity';
import { type PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';
import { type OpportunityWorkspaceEntity } from 'src/modules/opportunity/standard-objects/opportunity.workspace-entity';
import { type IgnoreRuleWorkspaceEntity } from 'src/modules/pop-creations/standard-objects/ignore-rule.workspace-entity';
import { type AiModelConfigWorkspaceEntity } from 'src/modules/pop-creations/standard-objects/ai-model-config.workspace-entity';

// ─── Types ──────────────────────────────────────────────────────────────────

export type RoutingStatus =
  | 'ROUTED'
  | 'COMPANY_DEPT'
  | 'COMPANY_ONLY'
  | 'UNROUTED'
  | 'SKIPPED';

export type RoutingMethod =
  | 'PO_NUMBER'
  | 'SO_NUMBER'
  | 'FUZZY_NAME'
  | 'EMAIL_DOMAIN'
  | 'AI'
  | 'MANUAL'
  | 'AUTO_SKIP';

export type RoutingResult = {
  companyId: string | null;
  departmentId: string | null;
  programId: string | null;
  routingStatus: RoutingStatus;
  routingMethod: RoutingMethod | null;
  confidence: number;
};

// ─── Constants ──────────────────────────────────────────────────────────────

const PO_PATTERN = /\b([DS]\d{4})\b/gi;
const INTERNAL_DOMAIN = 'popcre.com';

const NOISE_DOMAINS = [
  'gmail.com',
  'outlook.com',
  'hotmail.com',
  'yahoo.com',
  'clickup.com',
  'teams.mail.microsoft.com',
  'fireflies.ai',
  'sharepointonline.com',
  'avanan-mail.net',
];

const NOISE_DOMAIN_PREFIXES = ['notification.', 'news.', 'nl.'];

const NOISE_SENDER_PATTERNS = [
  'no-reply@',
  'noreply@',
  'donotreply@',
  'notifications@',
  'support@',
  'billing@',
];

// OpenRouter model IDs — all routed through https://openrouter.ai/api/v1
const MODEL_VALUE_MAP: Record<string, string> = {
  GPT_5_4: 'openai/gpt-5.4',
  GPT_5_4_MINI: 'openai/gpt-5.4-mini',
  GPT_5_4_NANO: 'openai/gpt-5.4-nano',
  GEMINI_3_1_PRO: 'google/gemini-3.1-pro-preview',
  GEMINI_3_FLASH: 'google/gemini-3-flash-preview',
  GEMINI_3_1_FLASH_LITE: 'google/gemini-3.1-flash-lite-preview',
  GEMINI_3_1_FLASH_IMAGE: 'google/gemini-3.1-flash-image-preview',
  CLAUDE_SONNET_4_6: 'anthropic/claude-sonnet-4-6',
  CLAUDE_HAIKU_4_5: 'anthropic/claude-haiku-4-5',
};

// ── Shared-domain disambiguation ────────────────────────────────────────────
// When two customer companies share an email domain (e.g. Ross Stores and
// DD's Discounts both use @ros.com), the router uses participant display names
// to decide which company owns the email.
//
// Each entry: domain → list of subsidiaries, each with:
//   keywords          — substrings to look for in participant display names (case-insensitive)
//   companyNameFragment — substring of the company's name in Twenty (used to pick
//                         the right row from the ambiguous company list)
//
// The parent company (Ross Stores itself) needs no entry — it wins by default
// when no subsidiary keyword is found.
const SHARED_DOMAIN_RULES: Array<{
  domain: string;
  subsidiaries: Array<{ keywords: string[]; companyNameFragment: string }>;
}> = [
  {
    domain: 'ros.com',
    subsidiaries: [
      { keywords: ["DDS", "DD'S", 'NYBO'], companyNameFragment: "DD" },
    ],
  },
];

const STATUS_PRIORITY: Record<string, number> = {
  UNROUTED: 0,
  COMPANY_ONLY: 1,
  COMPANY_DEPT: 2,
  ROUTED: 3,
  SKIPPED: -1,
};

// ─── Helper functions ───────────────────────────────────────────────────────

function isNoiseDomain(domain: string): boolean {
  if (NOISE_DOMAINS.includes(domain)) return true;
  return NOISE_DOMAIN_PREFIXES.some((prefix) => domain.startsWith(prefix));
}

function isNoiseSender(
  address: string,
  isCustomerDomain: boolean,
): boolean {
  const lower = address.toLowerCase();
  if (lower.startsWith('info@') && !isCustomerDomain) return true;
  return NOISE_SENDER_PATTERNS.some((p) => lower.startsWith(p));
}

function extractPoNumbers(text: string): string[] {
  return [
    ...new Set((text.match(PO_PATTERN) ?? []).map((m) => m.toUpperCase())),
  ];
}

function extractExternalDomains(addresses: string[]): string[] {
  return [
    ...new Set(
      addresses
        .map((a) => a.split('@')[1]?.toLowerCase())
        .filter(
          (d): d is string => Boolean(d) && d !== INTERNAL_DOMAIN,
        ),
    ),
  ];
}

function fuzzyScore(query: string, target: string): number {
  const qTokens = query
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 2);
  const tLower = target.toLowerCase();
  if (qTokens.length === 0) return 0;
  const hits = qTokens.filter((t) => tLower.includes(t)).length;
  return hits / qTokens.length;
}

function normalizeSubject(subject: string): string {
  return subject.replace(/^(RE:|FW:|Fwd:)\s*/gi, '').trim();
}

/** Extract every email address that appears anywhere in a string (e.g. quoted thread body). */
function extractAddressesFromText(text: string): string[] {
  const matches = text.match(
    /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
  );
  return [...new Set((matches ?? []).map((a) => a.toLowerCase()))];
}

function resolveModel(stored: string): string {
  return MODEL_VALUE_MAP[stored] ?? stored;
}

// ─── Service ────────────────────────────────────────────────────────────────

@Injectable()
export class EmailRouterService {
  private readonly logger = new Logger(EmailRouterService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  async routeEmail(
    workspaceId: string,
    opts: {
      subject: string;
      bodyText: string;
      emailAddresses: string[];
      /** address.toLowerCase() → display name, used for shared-domain disambiguation */
      displayNames?: Record<string, string>;
      task?: 'emailRoutingModel' | 'firefliesRoutingModel';
    },
  ): Promise<RoutingResult> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const searchText = `${opts.subject} ${opts.bodyText}`;
        const externalDomains = extractExternalDomains(
          opts.emailAddresses,
        );

        // ── Auto-skip check ────────────────────────────────────────────
        if (externalDomains.length === 0) {
          return this.skipped();
        }

        const nonNoiseDomains = externalDomains.filter(
          (d) => !isNoiseDomain(d),
        );
        if (nonNoiseDomains.length === 0) {
          return this.skipped();
        }

        const senderAddress =
          opts.emailAddresses[0]?.toLowerCase() ?? '';

        // ── Check ignore rules ─────────────────────────────────────────
        const ignoreRuleRepo =
          await this.globalWorkspaceOrmManager.getRepository<IgnoreRuleWorkspaceEntity>(
            workspaceId,
            'ignoreRule',
            { shouldBypassPermissionChecks: true },
          );
        const ignoreRules = await ignoreRuleRepo.find();

        const normalizedSubject = normalizeSubject(opts.subject)
          .trim()
          .toLowerCase();
        for (const rule of ignoreRules) {
          const p = (rule.pattern ?? '').toLowerCase();
          const match = rule.matchType ?? 'CONTAINS';
          const matched =
            (match === 'EXACT' && normalizedSubject === p) ||
            (match === 'STARTS_WITH' &&
              normalizedSubject.startsWith(p)) ||
            (match === 'CONTAINS' && normalizedSubject.includes(p));
          if (matched) {
            return this.skipped();
          }
        }

        // ── Step 1: Domain → Company ───────────────────────────────────
        const companyRepo =
          await this.globalWorkspaceOrmManager.getRepository<CompanyWorkspaceEntity>(
            workspaceId,
            'company',
            { shouldBypassPermissionChecks: true },
          );

        let companyId: string | null = null;
        let companyCustomerStatus: string | null = null;

        for (const domain of nonNoiseDomains) {
          const companies = await companyRepo
            .createQueryBuilder('company')
            .where(
              `company."domainNamePrimaryLinkUrl" ILIKE :domain`,
              { domain: `%${domain}%` },
            )
            .andWhere(
              `company."customerStatus" IN (:...statuses)`,
              {
                statuses: [
                  'ACTIVE_CUSTOMER',
                  'POTENTIAL_CUSTOMER',
                ],
              },
            )
            .limit(10)
            .getMany();

          if (companies.length === 1) {
            companyId = companies[0].id;
            companyCustomerStatus =
              (companies[0] as any).customerStatus ?? null;
            break;
          }

          // ── Shared-domain disambiguation ──────────────────────────────
          // When multiple companies match the same domain (e.g. Ross Stores
          // and DD's both on @ros.com), use two signals in order:
          //   1. Person records: if all known contacts for this domain share
          //      one companyId, use it (works for existing contacts).
          //   2. Display name keywords: check SHARED_DOMAIN_RULES for
          //      subsidiary keywords in participant display names.
          if (companies.length > 1) {
            const domainAddresses = opts.emailAddresses.filter((a) =>
              a.toLowerCase().endsWith(`@${domain}`),
            );

            // Signal 1: Person record lookup
            const personRepo =
              await this.globalWorkspaceOrmManager.getRepository<PersonWorkspaceEntity>(
                workspaceId,
                'person',
                { shouldBypassPermissionChecks: true },
              );
            const knownPeople = await personRepo
              .createQueryBuilder('person')
              .where(`person."emailsPrimaryEmail" IN (:...emails)`, {
                emails: domainAddresses.map((a) => a.toLowerCase()),
              })
              .getMany();
            const personCompanyIds = [
              ...new Set(
                knownPeople
                  .map((p) => (p as any).companyId)
                  .filter((id): id is string => Boolean(id)),
              ),
            ];
            if (personCompanyIds.length === 1) {
              const matched = companies.find((c) => c.id === personCompanyIds[0]);
              if (matched) {
                companyId = matched.id;
                companyCustomerStatus = (matched as any).customerStatus ?? null;
                this.logger.debug(
                  `Shared-domain "${domain}" resolved via Person records → company ${companyId}`,
                );
                break;
              }
            }

            // Signal 2: Display name keyword matching
            const sharedRule = SHARED_DOMAIN_RULES.find(
              (r) => r.domain === domain,
            );
            if (sharedRule && opts.displayNames) {
              const domainDisplayNames = domainAddresses
                .map((a) => opts.displayNames![a.toLowerCase()] ?? '')
                .filter(Boolean)
                .map((n) => n.toUpperCase());

              for (const subsidiary of sharedRule.subsidiaries) {
                const keywordHit = subsidiary.keywords.some((kw) =>
                  domainDisplayNames.some((dn) => dn.includes(kw.toUpperCase())),
                );
                if (keywordHit) {
                  const fragment = subsidiary.companyNameFragment.toLowerCase();
                  const matched = companies.filter((c) =>
                    ((c as any).name ?? '').toLowerCase().includes(fragment),
                  );
                  if (matched.length === 1) {
                    companyId = matched[0].id;
                    companyCustomerStatus =
                      (matched[0] as any).customerStatus ?? null;
                    this.logger.debug(
                      `Shared-domain "${domain}" resolved via display-name keyword "${subsidiary.keywords[0]}" → company ${companyId}`,
                    );
                    break;
                  }
                }
              }
              if (companyId) break;
            }
          }
        }

        // ── Step 1b: Thread-scan fallback ─────────────────────────────
        // If direct headers found no company, parse ALL email addresses from
        // the body text (which contains quoted From:/To:/CC: lines from prior
        // emails in the thread). Route to a company only if exactly ONE
        // customer domain appears — ambiguous threads stay UNROUTED.
        if (!companyId && opts.bodyText) {
          const threadAddresses = extractAddressesFromText(opts.bodyText).filter(
            (a) => !a.endsWith(`@${INTERNAL_DOMAIN}`),
          );
          const threadDomains = extractExternalDomains(threadAddresses).filter(
            (d) => !isNoiseDomain(d),
          );

          const threadMatches: { id: string; status: string }[] = [];

          for (const domain of threadDomains) {
            const companies = await companyRepo
              .createQueryBuilder('company')
              .where(`company."domainNamePrimaryLinkUrl" ILIKE :domain`, {
                domain: `%${domain}%`,
              })
              .andWhere(`company."customerStatus" IN (:...statuses)`, {
                statuses: ['ACTIVE_CUSTOMER', 'POTENTIAL_CUSTOMER'],
              })
              .limit(2)
              .getMany();

            for (const c of companies) {
              if (!threadMatches.some((m) => m.id === c.id)) {
                threadMatches.push({
                  id: c.id,
                  status: (c as any).customerStatus,
                });
              }
            }
          }

          if (threadMatches.length === 1) {
            companyId = threadMatches[0].id;
            companyCustomerStatus = threadMatches[0].status;
            this.logger.debug(
              `Thread-scan routed "${opts.subject}" → company ${companyId}`,
            );
          }
          // 0 or 2+ matches → leave companyId null, continue to UNROUTED
        }

        // Sender noise check
        if (
          !companyId &&
          isNoiseSender(senderAddress, false)
        ) {
          return this.skipped(0.9);
        }

        // OTHER company → skip
        if (companyCustomerStatus === 'OTHER') {
          return {
            companyId,
            departmentId: null,
            programId: null,
            routingStatus: 'SKIPPED',
            routingMethod: 'AUTO_SKIP',
            confidence: 0.9,
          };
        }

        // ── Step 2: Department narrowing ───────────────────────────────
        // Exclusive attribution: if exactly one DEPARTMENT-scoped person
        // appears across all addresses (direct headers + thread body scan),
        // attribute to that department.  Central-office people (no scope or
        // scope !== 'DEPARTMENT') are deliberately excluded.
        let departmentId: string | null = null;

        if (companyId) {
          const personRepo =
            await this.globalWorkspaceOrmManager.getRepository<PersonWorkspaceEntity>(
              workspaceId,
              'person',
              { shouldBypassPermissionChecks: true },
            );

          // Combine direct header addresses with any addresses found in the
          // quoted thread body (same technique as Step 1b thread-scan).
          const bodyTextAddresses = opts.bodyText
            ? extractAddressesFromText(opts.bodyText)
            : [];

          const emailAddressFilter = [
            ...new Set(
              [...opts.emailAddresses, ...bodyTextAddresses]
                .map((a) => a.toLowerCase())
                .filter((a) => !a.endsWith(`@${INTERNAL_DOMAIN}`)),
            ),
          ];

          if (emailAddressFilter.length > 0) {
            const people = await personRepo
              .createQueryBuilder('person')
              .where(`person."companyId" = :companyId`, {
                companyId,
              })
              .andWhere(
                `person."emailsPrimaryEmail" IN (:...emails)`,
                { emails: emailAddressFilter },
              )
              .getMany();

            const deptPeople = people.filter(
              (p: any) =>
                p.scope === 'DEPARTMENT' && p.departmentId,
            );
            const uniqueDepts = [
              ...new Set(
                deptPeople.map((p: any) => p.departmentId),
              ),
            ];
            if (uniqueDepts.length === 1) {
              departmentId = uniqueDepts[0]!;
            }
          }
        }

        // ── Step 3: PO/SO number matching ──────────────────────────────
        const opportunityRepo =
          await this.globalWorkspaceOrmManager.getRepository<OpportunityWorkspaceEntity>(
            workspaceId,
            'opportunity',
            { shouldBypassPermissionChecks: true },
          );

        for (const po of extractPoNumbers(searchText)) {
          const qb = opportunityRepo
            .createQueryBuilder('opp')
            .where(`opp."productionPoNumber" = :po`, { po })
            .limit(1);
          if (companyId) {
            qb.andWhere(`opp."companyId" = :companyId`, {
              companyId,
            });
          }
          const match = await qb.getOne();
          if (match) {
            return {
              companyId:
                companyId ?? (match as any).companyId ?? null,
              departmentId:
                departmentId ??
                (match as any).departmentId ??
                null,
              programId: match.id,
              routingStatus: 'ROUTED',
              routingMethod: 'PO_NUMBER',
              confidence: 1.0,
            };
          }
        }

        // Load active programs for SO + fuzzy + AI matching
        const programQb = opportunityRepo
          .createQueryBuilder('opp')
          .leftJoinAndSelect('opp.company', 'company')
          .where(`opp."stage" NOT IN (:...closedStages)`, {
            closedStages: ['CLOSED', 'SHIPPED'],
          })
          .limit(500);
        if (companyId) {
          programQb.andWhere(`opp."companyId" = :companyId`, {
            companyId,
          });
        }
        const programs = await programQb.getMany();

        // SO number exact substring
        for (const prog of programs) {
          const so = (prog as any).salesOrderNumber?.trim();
          if (so && so.length >= 4 && searchText.includes(so)) {
            return {
              companyId:
                companyId ?? (prog as any).companyId ?? null,
              departmentId:
                departmentId ??
                (prog as any).departmentId ??
                null,
              programId: prog.id,
              routingStatus: 'ROUTED',
              routingMethod: 'SO_NUMBER',
              confidence: 0.95,
            };
          }
        }

        // ── Step 4: Fuzzy name match ───────────────────────────────────
        let bestFuzzy: {
          id: string;
          score: number;
          companyId?: string;
          departmentId?: string;
        } | null = null;

        for (const prog of programs) {
          const nameScore = fuzzyScore(
            searchText,
            (prog as any).name ?? '',
          );
          const companyName =
            (prog as any).company?.name ?? '';
          const companyScore = companyName
            ? fuzzyScore(searchText, companyName)
            : 0;
          const score = Math.max(nameScore, companyScore);
          if (
            score >= 0.4 &&
            (!bestFuzzy || score > bestFuzzy.score)
          ) {
            bestFuzzy = {
              id: prog.id,
              score,
              companyId: (prog as any).companyId,
              departmentId: (prog as any).departmentId,
            };
          }
        }

        if (bestFuzzy && bestFuzzy.score >= 0.5) {
          return {
            companyId:
              companyId ?? bestFuzzy.companyId ?? null,
            departmentId:
              departmentId ?? bestFuzzy.departmentId ?? null,
            programId: bestFuzzy.id,
            routingStatus: 'ROUTED',
            routingMethod: 'FUZZY_NAME',
            confidence: bestFuzzy.score,
          };
        }

        // ── Step 5: AI matching ────────────────────────────────────────
        const aiModelStored = await this.getRoutingModel(
          workspaceId,
          opts.task ?? 'emailRoutingModel',
        );

        if (aiModelStored && programs.length > 0) {
          const aiModel = resolveModel(aiModelStored);
          const hasKey = !!process.env.OPENROUTER_API_KEY;

          if (hasKey) {
            const programList = programs
              .slice(0, 50)
              .map(
                (p, i) =>
                  `${i + 1}. [${p.id}] ${(p as any).name}${(p as any).company?.name ? ` (${(p as any).company.name})` : ''}`,
              )
              .join('\n');

            const systemPrompt = `You are a routing assistant for POP Creations, a wholesale product company.
Given an email or meeting note, identify which active program it most likely relates to.
Respond with ONLY the program ID (the UUID in brackets) or "NONE" if no match is confident.`;

            const userMessage = `Subject: ${opts.subject}\nContent: ${opts.bodyText.slice(0, 800)}\n\nActive programs:\n${programList}`;

            try {
              const aiResponse = (
                await this.callAI(
                  aiModel,
                  systemPrompt,
                  userMessage,
                )
              ).trim();
              const uuidMatch = aiResponse.match(
                /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
              );
              if (uuidMatch) {
                const matchedProg = programs.find(
                  (p) => p.id === uuidMatch[0],
                );
                if (matchedProg) {
                  return {
                    companyId:
                      companyId ??
                      (matchedProg as any).companyId ??
                      null,
                    departmentId:
                      departmentId ??
                      (matchedProg as any).departmentId ??
                      null,
                    programId: matchedProg.id,
                    routingStatus: 'ROUTED',
                    routingMethod: 'AI',
                    confidence: 0.75,
                  };
                }
              }
            } catch (e) {
              this.logger.warn('AI routing failed, falling back', e);
            }
          }
        }

        // ── Fall back to best fuzzy ────────────────────────────────────
        if (bestFuzzy) {
          return {
            companyId:
              companyId ?? bestFuzzy.companyId ?? null,
            departmentId:
              departmentId ?? bestFuzzy.departmentId ?? null,
            programId: bestFuzzy.id,
            routingStatus: 'ROUTED',
            routingMethod: 'FUZZY_NAME',
            confidence: bestFuzzy.score,
          };
        }

        // ── Partial routing ────────────────────────────────────────────
        if (companyId && departmentId) {
          return {
            companyId,
            departmentId,
            programId: null,
            routingStatus: 'COMPANY_DEPT',
            routingMethod: 'EMAIL_DOMAIN',
            confidence: 0.6,
          };
        }
        if (companyId) {
          return {
            companyId,
            departmentId: null,
            programId: null,
            routingStatus: 'COMPANY_ONLY',
            routingMethod: 'EMAIL_DOMAIN',
            confidence: 0.5,
          };
        }

        return {
          companyId: null,
          departmentId: null,
          programId: null,
          routingStatus: 'UNROUTED',
          routingMethod: null,
          confidence: 0,
        };
      },
      authContext,
    );
  }

  isImprovement(current: string, newResult: RoutingResult): boolean {
    const currentPriority = STATUS_PRIORITY[current] ?? 0;
    const newPriority =
      STATUS_PRIORITY[newResult.routingStatus] ?? 0;
    return newPriority > currentPriority;
  }

  private skipped(confidence = 1.0): RoutingResult {
    return {
      companyId: null,
      departmentId: null,
      programId: null,
      routingStatus: 'SKIPPED',
      routingMethod: 'AUTO_SKIP',
      confidence,
    };
  }

  private async getRoutingModel(
    workspaceId: string,
    task: 'emailRoutingModel' | 'firefliesRoutingModel',
  ): Promise<string | null> {
    const configRepo =
      await this.globalWorkspaceOrmManager.getRepository<AiModelConfigWorkspaceEntity>(
        workspaceId,
        'aiModelConfig',
        { shouldBypassPermissionChecks: true },
      );
    const configs = await configRepo.find({ take: 1 });
    return (configs[0] as any)?.[task] ?? null;
  }

  private async callAI(
    model: string,
    systemPrompt: string,
    userMessage: string,
  ): Promise<string> {
    const res = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY ?? ''}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          max_tokens: 200,
          temperature: 0,
        }),
      },
    );
    const d = await res.json();
    return d.choices?.[0]?.message?.content ?? '';
  }
}
