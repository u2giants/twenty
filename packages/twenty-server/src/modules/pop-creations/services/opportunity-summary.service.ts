/**
 * OpportunitySummaryService
 *
 * Maintains two artefacts per Opportunity, updated via a single structured
 * AI call whenever an email is routed to it:
 *
 *   aiState   (stored as JSON string, backend only)
 *     Machine-readable canonical state enforced by OpenRouter JSON-Schema
 *     structured outputs.  Contains typed, ID-stable arrays for action items,
 *     key facts, blockers, decisions, people, and a curated timeline.
 *     Items are never hard-deleted — they are closed/resolved/deactivated so
 *     history is preserved.
 *
 *   aiSummary (text, displayed in UI)
 *     Human prose derived from the structured state — one status line plus
 *     5–10 sentences covering each department.  Extracted from the
 *     human_summary field that is part of the structured output.
 *
 * Chat reads aiState (formatted as context) — never re-ingests raw emails.
 *
 * Model: google/gemini-2.0-flash-001 by default (cheap + supports JSON-schema
 * structured outputs via OpenRouter).  Override via AiModelConfig.opportunitySummaryModel.
 *
 * Note on semantic drift: structured outputs prevent *shape* drift (wrong
 * field names / types).  They do not prevent the model from quietly dropping
 * a fact.  The system prompt therefore explicitly instructs the model to
 * preserve all still-valid prior facts and uses stable IDs on every item so
 * the model can update items consistently rather than rewriting them.
 */

import { Injectable, Logger } from '@nestjs/common';

import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { type OpportunityWorkspaceEntity } from 'src/modules/opportunity/standard-objects/opportunity.workspace-entity';
import { type AiModelConfigWorkspaceEntity } from 'src/modules/pop-creations/standard-objects/ai-model-config.workspace-entity';
import { MODEL_VALUE_MAP } from 'src/modules/pop-creations/services/email-router.service';

// ─── Types ──────────────────────────────────────────────────────────────────

export type OpportunityStatus =
  | 'awaiting_retailer_feedback'
  | 'awaiting_internal_design'
  | 'awaiting_factory_quote'
  | 'awaiting_sample_approval'
  | 'awaiting_licensor_approval'
  | 'in_production'
  | 'shipped'
  | 'on_hold'
  | 'closed_won'
  | 'closed_lost'
  | 'unknown';

export type OpportunityState = {
  status: OpportunityStatus;
  stage_confidence: number;
  last_meaningful_update: string;

  people: Array<{
    name: string;
    company: string;
    role: string;
    email: string | null;
  }>;

  action_items: Array<{
    id: string; // e.g. AI-1, AI-2
    task: string;
    type: 'task' | 'question' | 'decision_needed';
    owner: string | null;
    due_date: string | null; // ISO date string or null
    status: 'open' | 'done' | 'blocked';
  }>;

  key_facts: Array<{
    id: string; // e.g. KF-1, KF-2
    category:
      | 'retailer_request'
      | 'design'
      | 'costing'
      | 'compliance'
      | 'shipping'
      | 'production'
      | 'licensing'
      | 'timeline';
    fact: string;
    active: boolean; // false = superseded/resolved, kept for history
    date: string | null;
  }>;

  blockers: Array<{
    id: string; // e.g. BL-1, BL-2
    blocker: string;
    owner: string | null;
    status: 'open' | 'resolved';
    resolved_date: string | null;
  }>;

  decisions: Array<{
    id: string; // e.g. D-1, D-2
    decision: string;
    date: string | null;
  }>;

  change_log: string; // What changed in this update (1–3 sentences)
  needs_human_review: boolean;
  review_reason: string | null;
  human_summary: string; // One-liner status + 5–10 sentence department overview
};

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_SUMMARY_MODEL = 'google/gemini-2.0-flash-001';

/**
 * OpenRouter JSON-Schema structured output definition.
 * strict:true requires every property in required[] and additionalProperties:false
 * on every object — including nested ones.
 */
const OPPORTUNITY_STATE_SCHEMA = {
  name: 'opportunity_state',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: [
          'awaiting_retailer_feedback',
          'awaiting_internal_design',
          'awaiting_factory_quote',
          'awaiting_sample_approval',
          'awaiting_licensor_approval',
          'in_production',
          'shipped',
          'on_hold',
          'closed_won',
          'closed_lost',
          'unknown',
        ],
      },
      stage_confidence: { type: 'number' },
      last_meaningful_update: { type: 'string' },
      people: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            company: { type: 'string' },
            role: { type: 'string' },
            email: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          },
          required: ['name', 'company', 'role', 'email'],
          additionalProperties: false,
        },
      },
      action_items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            task: { type: 'string' },
            type: {
              type: 'string',
              enum: ['task', 'question', 'decision_needed'],
            },
            owner: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            due_date: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            status: { type: 'string', enum: ['open', 'done', 'blocked'] },
          },
          required: ['id', 'task', 'type', 'owner', 'due_date', 'status'],
          additionalProperties: false,
        },
      },
      key_facts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            category: {
              type: 'string',
              enum: [
                'retailer_request',
                'design',
                'costing',
                'compliance',
                'shipping',
                'production',
                'licensing',
                'timeline',
              ],
            },
            fact: { type: 'string' },
            active: { type: 'boolean' },
            date: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          },
          required: ['id', 'category', 'fact', 'active', 'date'],
          additionalProperties: false,
        },
      },
      blockers: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            blocker: { type: 'string' },
            owner: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            status: { type: 'string', enum: ['open', 'resolved'] },
            resolved_date: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          },
          required: ['id', 'blocker', 'owner', 'status', 'resolved_date'],
          additionalProperties: false,
        },
      },
      decisions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            decision: { type: 'string' },
            date: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          },
          required: ['id', 'decision', 'date'],
          additionalProperties: false,
        },
      },
      change_log: { type: 'string' },
      needs_human_review: { type: 'boolean' },
      review_reason: { anyOf: [{ type: 'string' }, { type: 'null' }] },
      human_summary: { type: 'string' },
    },
    required: [
      'status',
      'stage_confidence',
      'last_meaningful_update',
      'people',
      'action_items',
      'key_facts',
      'blockers',
      'decisions',
      'change_log',
      'needs_human_review',
      'review_reason',
      'human_summary',
    ],
    additionalProperties: false,
  },
};

// ─── Service ────────────────────────────────────────────────────────────────

@Injectable()
export class OpportunitySummaryService {
  private readonly logger = new Logger(OpportunitySummaryService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  /**
   * Called after an email is routed to an opportunity.
   * Produces a full updated OpportunityState via structured output and saves:
   *   - aiState:   serialized JSON (canonical machine state)
   *   - aiSummary: human_summary field from the state (prose shown in UI)
   */
  async updateSummary(
    workspaceId: string,
    opportunityId: string,
    newEmail: { subject: string; bodyPreview: string; sender: string },
  ): Promise<void> {
    if (!process.env.OPENROUTER_API_KEY) return;

    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      const oppRepo =
        await this.globalWorkspaceOrmManager.getRepository<OpportunityWorkspaceEntity>(
          workspaceId,
          'opportunity',
          { shouldBypassPermissionChecks: true },
        );

      const opp = await oppRepo.findOne({ where: { id: opportunityId } });
      if (!opp) return;

      const currentState = this.parseState((opp as any).aiState);
      const model = await this.getSummaryModel(workspaceId);
      const today = new Date().toISOString().slice(0, 10);

      const systemPrompt = this.buildSystemPrompt();
      const userMessage = this.buildUpdateMessage(
        opp,
        currentState,
        newEmail,
        today,
      );

      try {
        const raw = await this.callAI(
          model,
          systemPrompt,
          userMessage,
          2500,
          OPPORTUNITY_STATE_SCHEMA,
        );

        const newState = JSON.parse(raw) as OpportunityState;

        await oppRepo.update({ id: opportunityId }, {
          aiState: JSON.stringify(newState),
          aiSummary: newState.human_summary ?? null,
        } as any);

        this.logger.debug(
          `Updated aiState for opportunity ${opportunityId} ` +
            `(status: ${newState.status}, review: ${newState.needs_human_review})`,
        );
      } catch (err) {
        this.logger.warn(
          `Failed to update state for opportunity ${opportunityId}: ${err}`,
        );
      }
    }, authContext);
  }

  /**
   * Answer a natural-language question about a specific opportunity.
   * Reads aiState — does NOT re-ingest raw emails.
   */
  async chat(
    workspaceId: string,
    opportunityId: string,
    question: string,
  ): Promise<string> {
    if (!process.env.OPENROUTER_API_KEY) {
      return 'AI is not configured (missing OPENROUTER_API_KEY).';
    }

    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const oppRepo =
          await this.globalWorkspaceOrmManager.getRepository<OpportunityWorkspaceEntity>(
            workspaceId,
            'opportunity',
            { shouldBypassPermissionChecks: true },
          );

        const opp = await oppRepo.findOne({ where: { id: opportunityId } });
        if (!opp) return 'Opportunity not found.';

        const state = this.parseState((opp as any).aiState);
        if (!state) {
          return `No state exists for "${opp.name}" yet. It will be built automatically when the next email arrives.`;
        }

        const model = await this.getSummaryModel(workspaceId);

        const systemPrompt =
          `You are a knowledgeable assistant for POP Creations, a wholesale product company. ` +
          `Answer questions about a specific program using only the structured state provided. ` +
          `Be concise and factual. If the answer is not in the state, say so clearly.`;

        const userMessage =
          `Program: ${opp.name}  |  Stage: ${opp.stage ?? 'unknown'}\n\n` +
          `=== CURRENT STATE ===\n${this.formatStateForChat(state)}\n\n` +
          `Question: ${question}`;

        try {
          return await this.callAI(model, systemPrompt, userMessage, 700);
        } catch (err) {
          this.logger.warn(`Chat AI call failed: ${err}`);
          return 'Sorry, I could not answer that question right now. Please try again.';
        }
      },
      authContext,
    );
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private buildSystemPrompt(): string {
    return (
      `You are the internal knowledge manager for POP Creations, a wholesale product company ` +
      `that designs and sources retail products. You maintain a canonical machine-readable ` +
      `state object for each program, updated whenever a new email arrives.\n\n` +
      `CRITICAL RULES — you must follow these exactly:\n` +
      `1. PRESERVE STABLE IDs. Every existing item has an id (e.g. AI-3, KF-7, BL-2, D-1). ` +
      `   When updating an existing item keep its exact id unchanged. ` +
      `   Only assign new ids to genuinely new items added in this update.\n` +
      `2. ID FORMAT for new items: {prefix}-{n} where n is one more than the highest ` +
      `   existing number for that prefix. Prefixes: AI (action_items), KF (key_facts), ` +
      `   BL (blockers), D (decisions). If no items exist yet for a prefix, start at 1.\n` +
      `3. NEVER hard-delete. To close an action item set status="done". To invalidate a ` +
      `   key_fact set active=false. To resolve a blocker set status="resolved" and ` +
      `   resolved_date to today. Items are kept for history.\n` +
      `4. PRESERVE all still-valid prior facts. Only change a fact if the new email ` +
      `   clearly changes or invalidates it. When in doubt, preserve.\n` +
      `5. Set needs_human_review=true if: the email contains a complaint or escalation, ` +
      `   contradicts prior state, requires a human decision, or you are genuinely unsure.\n` +
      `6. human_summary: first sentence is the current one-line status ` +
      `   (e.g. "Waiting for design to send the tech pack and for the licensor to approve PP samples."). ` +
      `   Then a blank line. Then 5–10 sentences in plain prose covering buyer/sales, ` +
      `   production/sourcing, design, and licensing (if applicable). No bullet points, no headings.\n` +
      `7. change_log: 1–3 sentences describing only what changed in this update.`
    );
  }

  private buildUpdateMessage(
    opp: OpportunityWorkspaceEntity,
    currentState: OpportunityState | null,
    newEmail: { subject: string; bodyPreview: string; sender: string },
    today: string,
  ): string {
    const stateSection = currentState
      ? `=== CURRENT STATE (JSON) ===\n${JSON.stringify(currentState, null, 2)}`
      : `=== CURRENT STATE ===\n(no state yet — this is the first email for this program)`;

    return (
      `Program: ${opp.name}  |  CRM Stage: ${opp.stage ?? 'unknown'}  |  Today: ${today}\n\n` +
      `${stateSection}\n\n` +
      `=== NEW EMAIL ===\n` +
      `From: ${newEmail.sender}\n` +
      `Subject: ${newEmail.subject}\n` +
      (newEmail.bodyPreview
        ? `Body preview: ${newEmail.bodyPreview.slice(0, 800)}\n`
        : '') +
      `\nReturn the full updated state as valid JSON matching the required schema.`
    );
  }

  /**
   * Format the structured state as readable text for the chat AI.
   * The chat AI gets prose context, not raw JSON, so it reasons naturally.
   */
  private formatStateForChat(state: OpportunityState): string {
    const lines: string[] = [];

    lines.push(
      `Status: ${state.status.replace(/_/g, ' ')} (confidence: ${Math.round(state.stage_confidence * 100)}%)`,
    );
    lines.push(`Last update: ${state.last_meaningful_update}`);
    lines.push('');

    if (state.people.length > 0) {
      lines.push('PEOPLE:');
      for (const p of state.people) {
        lines.push(
          `  ${p.name} — ${p.role} at ${p.company}${p.email ? ` (${p.email})` : ''}`,
        );
      }
      lines.push('');
    }

    const openActions = state.action_items.filter((a) => a.status !== 'done');
    if (openActions.length > 0) {
      lines.push('OPEN ACTION ITEMS:');
      for (const a of openActions) {
        const due = a.due_date ? ` (due ${a.due_date})` : '';
        const owner = a.owner ? ` — ${a.owner}` : '';
        lines.push(`  [${a.id}] ${a.task}${owner}${due} [${a.status}]`);
      }
      lines.push('');
    }

    const activeBlockers = state.blockers.filter((b) => b.status === 'open');
    if (activeBlockers.length > 0) {
      lines.push('BLOCKERS:');
      for (const b of activeBlockers) {
        lines.push(
          `  [${b.id}] ${b.blocker}${b.owner ? ` — owner: ${b.owner}` : ''}`,
        );
      }
      lines.push('');
    }

    const activeFacts = state.key_facts.filter((f) => f.active);
    if (activeFacts.length > 0) {
      lines.push('KEY FACTS:');
      for (const f of activeFacts) {
        lines.push(`  [${f.id}] (${f.category}) ${f.fact}`);
      }
      lines.push('');
    }

    if (state.decisions.length > 0) {
      lines.push('DECISIONS:');
      for (const d of state.decisions) {
        lines.push(`  [${d.id}] ${d.decision}${d.date ? ` (${d.date})` : ''}`);
      }
      lines.push('');
    }

    // Timeline: key_facts with category='timeline' + any resolved/done items give history
    const timelineFacts = state.key_facts.filter(
      (f) => f.category === 'timeline',
    );
    if (timelineFacts.length > 0) {
      lines.push('TIMELINE:');
      for (const f of timelineFacts) {
        lines.push(`  ${f.date ?? '?'} — ${f.fact}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  private parseState(raw: string | null | undefined): OpportunityState | null {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as OpportunityState;
    } catch {
      return null;
    }
  }

  private async getSummaryModel(workspaceId: string): Promise<string> {
    try {
      const configRepo =
        await this.globalWorkspaceOrmManager.getRepository<AiModelConfigWorkspaceEntity>(
          workspaceId,
          'aiModelConfig',
          { shouldBypassPermissionChecks: true },
        );
      const configs = await configRepo.find({ take: 1 });
      const stored = (configs[0] as any)?.opportunitySummaryModel ?? null;
      if (stored) {
        return MODEL_VALUE_MAP[stored] ?? stored;
      }
    } catch {
      // fall through to default
    }
    return DEFAULT_SUMMARY_MODEL;
  }

  private async callAI(
    model: string,
    systemPrompt: string,
    userMessage: string,
    maxTokens = 400,
    schema?: typeof OPPORTUNITY_STATE_SCHEMA,
  ): Promise<string> {
    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: maxTokens,
      temperature: 0.2,
    };

    if (schema) {
      body['response_format'] = {
        type: 'json_schema',
        json_schema: schema,
      };
    }

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY ?? ''}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`OpenRouter ${res.status}: ${errorText}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  }
}
