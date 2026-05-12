import { Effect, Layer } from "effect";
import {
  WalletResolver,
  ANONYMOUS_KEEPER,
  type WalletIdentity,
} from "../ports/wallet-resolver.port.ts";

const _fixture: Map<string, WalletIdentity> = new Map();
let _forceFailure = false;

export function seedWalletIdentity(identity: WalletIdentity): void {
  _fixture.set(identity.wallet_address, identity);
}

export function setMockWalletFailure(fail: boolean): void {
  _forceFailure = fail;
}

export function resetMockWalletResolver(): void {
  _fixture.clear();
  _forceFailure = false;
}

export const WalletResolverMock = Layer.succeed(
  WalletResolver,
  WalletResolver.of({
    resolve: (wallet) =>
      Effect.sync(() => {
        if (_forceFailure) return { ...ANONYMOUS_KEEPER };
        const addr = wallet as unknown as string;
        return _fixture.get(addr) ?? { ...ANONYMOUS_KEEPER };
      }),
    invalidate: (wallet) =>
      Effect.sync(() => {
        _fixture.delete(wallet as unknown as string);
      }),
  }),
);
