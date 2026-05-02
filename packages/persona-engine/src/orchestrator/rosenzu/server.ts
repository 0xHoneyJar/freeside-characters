/**
 * Rosenzu — in-bot SDK MCP server.
 *
 * Spatial awareness construct (Kevin Lynch lens) wrapped as an in-process
 * MCP server via `createSdkMcpServer`. No separate Railway/ECS deploy —
 * runs in the bot's own process, called by the SDK's agent loop.
 *
 * 6 tools (V0.7-A.1 — place + moment lens):
 *   place (Lynch spatial · V0.5-B):
 *     - get_current_district     — lynch primitive + archetype for zone
 *     - audit_spatial_threshold  — checks intent-zone matches landed-zone
 *     - fetch_landmarks          — orientation cues for zone
 *     - furnish_kansei           — per-fire sensory anchors (variance)
 *     - threshold                — departure → door → arrival between zones
 *   moment (Lynch temporal/social · V0.7-A.1):
 *     - read_room                — temperature + social density + tonal weight
 *
 * `read_room` derives the moment-shape of a zone-mapped channel right now
 * from substrate-assembled inputs (recent message count, summary, presence,
 * minutes-since-last-post). Pair with `get_current_district` for full
 * place + moment grounding before composing any reply.
 *
 * V0.5-C will add: persistent regular-recognition tool that rosenzu
 * surfaces (separate from /memories — rosenzu reads, /memories writes).
 */

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import {
  ZONE_SPATIAL,
  ALL_ZONES,
  composeTonalWeight,
  deriveSocialDensity,
  deriveTemperature,
  furnishKansei,
  type SpatialZoneId,
} from './lynch-primitives.ts';

// Spatial zones include the-warehouse (vocab-only, no Discord channel).
// Postable SpatialZoneId is a subset; rosenzu tools accept the wider set so
// weaver references and future-activation paths are pre-wired.
const ZoneSchema = z.enum([
  'stonehenge',
  'bear-cave',
  'el-dorado',
  'owsley-lab',
  'the-warehouse',
]);

function ok(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  };
}

export const rosenzuServer = createSdkMcpServer({
  name: 'rosenzu',
  version: '0.1.0',
  tools: [
    tool(
      'get_current_district',
      'Returns the spatial profile for a zone — lynch primitive (node/district/edge/path/inner_sanctum), codex archetype, era resonance, essence prose, baseline KANSEI vector. Call this BEFORE composing any post to ground the prose in place.',
      { zone: ZoneSchema },
      async ({ zone }) => {
        const profile = ZONE_SPATIAL[zone as SpatialZoneId];
        return ok({
          zone: profile.zone,
          primitive: profile.primitive,
          archetype: profile.archetype,
          era: profile.era,
          essence: profile.essence,
          base_kansei: profile.base_kansei,
          landmark_count: profile.landmarks.length,
          district_count: profile.districts.length,
        });
      },
    ),

    tool(
      'audit_spatial_threshold',
      'Validates that the zone you intend to post to matches the landed zone. Returns mismatch=true if your intended zone differs from the actual channel zone. Call before commit to guard against spatial blindness.',
      {
        intended_zone: ZoneSchema,
        landed_zone: ZoneSchema,
      },
      async ({ intended_zone, landed_zone }) => {
        const mismatch = intended_zone !== landed_zone;
        return ok({
          mismatch,
          intended_zone,
          landed_zone,
          guidance: mismatch
            ? `STOP — composing for ${intended_zone} but post is landing in ${landed_zone}. fix the zone reference or hand back to the cron router.`
            : 'aligned',
        });
      },
    ),

    tool(
      'fetch_landmarks',
      'Returns persistent orientation cues for a zone — landmarks, edges, districts, paths, nodes. Use these as anchor points in scene description so the place feels load-bearing across posts.',
      { zone: ZoneSchema },
      async ({ zone }) => {
        const profile = ZONE_SPATIAL[zone as SpatialZoneId];
        return ok({
          zone: profile.zone,
          landmarks: profile.landmarks,
          edges: profile.edges,
          districts: profile.districts,
          paths: profile.paths,
          nodes: profile.nodes,
        });
      },
    ),

    tool(
      'furnish_kansei',
      'Returns the FULL per-fire KANSEI vector for a zone — baseline warmth/motion/shadow/easing/feel + a current_anchors pick (light, sound, temperature, smell, motion). Same zone re-fired in different windows produces different anchor combinations — this is the variance engine that prevents Westworld-loop static descriptions. Call this BEFORE scene composition; let the anchors lead the sensory layering.',
      {
        zone: ZoneSchema,
        fire_id: z.number().int().optional().describe('Optional fire identifier for deterministic variance. Omit to seed from current hour.'),
      },
      async ({ zone, fire_id }) => {
        const vector = furnishKansei(zone as SpatialZoneId, fire_id);
        return ok(vector);
      },
    ),

    tool(
      'threshold',
      'Describes a transition between two zones — departure, door, arrival. Use this in WEAVER posts that move across zones, or when explicitly invoking a cross-zone reference. Returns a 3-frame structure the agent can layer into prose.',
      {
        from_zone: ZoneSchema,
        to_zone: ZoneSchema,
      },
      async ({ from_zone, to_zone }) => {
        if (from_zone === to_zone) {
          return ok({
            departure: null,
            door: null,
            arrival: null,
            note: 'no threshold — same zone',
          });
        }
        const fromProfile = ZONE_SPATIAL[from_zone as SpatialZoneId];
        const toProfile = ZONE_SPATIAL[to_zone as SpatialZoneId];
        return ok({
          departure: {
            zone: from_zone,
            primitive: fromProfile.primitive,
            leaving_feel: fromProfile.base_kansei.feel,
          },
          door: {
            edge: toProfile.edges[0] ?? `boundary-from-${from_zone}`,
            transition_register: `from ${fromProfile.base_kansei.feel} → ${toProfile.base_kansei.feel}`,
          },
          arrival: {
            zone: to_zone,
            primitive: toProfile.primitive,
            arriving_feel: toProfile.base_kansei.feel,
            first_landmark: toProfile.landmarks[0] ?? null,
          },
        });
      },
    ),

    tool(
      'read_room',
      'Reads the temporal/social state of a zone-mapped channel right now. Returns activity temperature (cold/cool/warm/hot), social density (solo/paired/small-cluster/crowd), tonal weight against the zone KANSEI baseline, presence list, and a brief vibe hint. Pair with get_current_district (place) for full place+moment grounding before composing any reply. The substrate pre-fetches a starting frame at compose time; call this mid-turn if you want a fresh read after a context shift.',
      {
        zone: ZoneSchema,
        recent_message_count: z.number().min(0).max(50).default(20),
        recent_message_summary: z
          .string()
          .optional()
          .describe('substrate-assembled one-line summary of recent messages, if any'),
        presence: z
          .array(z.string())
          .optional()
          .describe('user/character handles currently active in the channel'),
        minutes_since_last_post: z.number().optional(),
      },
      async ({
        zone,
        recent_message_count,
        recent_message_summary,
        presence,
        minutes_since_last_post,
      }) => {
        const profile = ZONE_SPATIAL[zone as SpatialZoneId];
        const temperature = deriveTemperature(recent_message_count, minutes_since_last_post);
        const social_density = deriveSocialDensity(presence?.length ?? 0);
        const tonal_weight = composeTonalWeight(profile.base_kansei, temperature);

        return ok({
          zone,
          temperature,
          social_density,
          tonal_weight,
          presence: presence ?? [],
          recent_vibe_hint: recent_message_summary
            ? `${profile.archetype} register · ${recent_message_summary.slice(0, 120)}`
            : null,
          grounding: `${profile.archetype} · ${profile.era} · currently ${temperature}`,
        });
      },
    ),
  ],
});

export const ROSENZU_TOOL_PREFIX = 'mcp__rosenzu__';
export const ROSENZU_ALLOWED_TOOLS = [`${ROSENZU_TOOL_PREFIX}*`];
export const ROSENZU_ZONES = ALL_ZONES;
