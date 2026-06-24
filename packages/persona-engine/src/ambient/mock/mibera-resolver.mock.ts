import { Effect, Layer } from "effect";
import {
  MiberaResolver,
  type MiberaIdentity,
} from "../ports/mibera-resolver.port.ts";

const _fixture: Map<number, MiberaIdentity> = new Map();

export function seedMiberaIdentity(id: MiberaIdentity): void {
  _fixture.set(id.tokenId, id);
}

export function resetMockMiberaResolver(): void {
  _fixture.clear();
}

/** Default identity used when no fixture is seeded (canon-correct shape). */
const DEFAULT_MIBERA: MiberaIdentity = {
  tokenId: 0,
  archetype: "Freetekno",
  ancestor: "Greek",
  element: "Earth",
  time_period: "Modern",
  drug: "St. John's Wort",
  swag_rank: "B",
  sun_sign: "Aries",
  moon_sign: "Aries",
  ascending_sign: "Aries",
};

export const MiberaResolverMock = Layer.succeed(
  MiberaResolver,
  MiberaResolver.of({
    lookup: (tokenId) =>
      Effect.sync(() => {
        const id = tokenId as unknown as number;
        const seeded = _fixture.get(id);
        if (seeded) return seeded;
        return { ...DEFAULT_MIBERA, tokenId: id };
      }),
    invalidate: (tokenId) =>
      Effect.sync(() => {
        _fixture.delete(tokenId as unknown as number);
      }),
  }),
);
