import type { Config } from '../config.ts';
import type { ActivityPulseMessage } from '../domain/activity-pulse.ts';
import type { ScoreFetchPort } from '../ports/score-fetch.port.ts';
import type { PresentationPort } from '../ports/presentation.port.ts';
import { createScoreMcpLive } from '../live/score-mcp.live.ts';
import { presentation } from '../live/discord-render.live.ts';

export interface PulseOrchestratorDeps {
  readonly score?: ScoreFetchPort;
  readonly presentation?: PresentationPort;
}

export async function composeActivityPulse(
  config: Config,
  deps: PulseOrchestratorDeps = {},
): Promise<ActivityPulseMessage> {
  const score = deps.score ?? createScoreMcpLive(config);
  const renderer = deps.presentation ?? presentation;
  if (!renderer.renderActivityPulse) {
    throw new Error('pulse-orchestrator: presentation port missing renderActivityPulse');
  }
  const pulse = await score.fetchActivityPulse({ limit: 10 });
  return renderer.renderActivityPulse(pulse);
}
