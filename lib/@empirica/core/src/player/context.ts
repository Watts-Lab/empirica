import { TajribaParticipant } from "@empirica/tajriba";
import { BehaviorSubject, Subject } from "rxjs";
import { subscribeAsync } from "../admin/observables";
import { Globals } from "../shared/globals";
import {
  ErrNotConnected,
  TajribaConnection,
} from "../shared/tajriba_connection";
import { warn } from "../utils/console";
import { bsu } from "../utils/object";
import { ParticipantConnection, ParticipantSession } from "./connection";
import { TajribaProvider } from "./provider";

export class ParticipantContext {
  readonly tajriba: TajribaConnection;
  readonly participant: ParticipantConnection;
  readonly session: ParticipantSession;
  readonly resetSession: Subject<void>;
  readonly provider = bsu<TajribaProvider>();
  readonly globals = bsu<Globals>();

  constructor(url: string, ns: string) {
    this.tajriba = new TajribaConnection(url);
    this.resetSession = new Subject<void>();
    this.session = new ParticipantSession(ns, this.resetSession);
    this.participant = new ParticipantConnection(
      this.tajriba,
      this.session.sessions,
      this.resetSession.next.bind(this.resetSession)
    );

    subscribeAsync(this.participant.connected, async (connected) => {
      const part = this.participant.participant.getValue();

      if (connected && part) {
        if (!this.provider.getValue()) {
          this.provider.next(
            new TajribaProvider(
              part.changes(),
              this.tajriba.tajriba.globalAttributes(),
              part.setAttributes.bind(part)
            )
          );
        }
      } else {
        const provider = this.provider.getValue();
        if (provider) {
          this.provider.next(undefined);
        }
      }
    });

    subscribeAsync(this.tajriba.connected, async (connected) => {
      if (connected) {
        this.globals.next(new Globals(this.tajriba.tajriba.globalAttributes()));
      } else {
        const glob = this.globals.getValue();
        if (glob) {
          this.globals.next(undefined);
        }
      }
    });
  }

  get connecting() {
    return this.participant.connecting;
  }

  get connected() {
    return this.participant.connected;
  }

  async register(playerIdentifier: string) {
    if (!this.tajriba.connected.getValue()) {
      throw ErrNotConnected;
    }

    const [token, participant] = await this.tajriba.tajriba.registerParticipant(
      playerIdentifier
    );

    if (!token) {
      throw new Error("invalid registration");
    }

    this.session.updateSession(token, participant);
  }

  stop() {
    this.tajriba.stop();
    this.participant.stop();
  }
}

export type Mode<T> = (participantID: string, provider: TajribaProvider) => T;

export class ParticipantMode<T> {
  private _mode = new BehaviorSubject<T | undefined>(undefined);

  constructor(
    participant: BehaviorSubject<TajribaParticipant | undefined>,
    provider: BehaviorSubject<TajribaProvider | undefined>,
    modeFunc: Mode<T>
  ) {
    subscribeAsync(provider, async (provider) => {
      const id = participant.getValue()?.id;

      // TODO Fix! Hack. If we detect this condition, reload
      // We are getting a new provider while we already had one. Presumably
      // the player is gone (tajriba reset), but we're still getting a
      // provider, while we shouldn't.
      if (id && provider && this._mode.getValue()) {
        warn("spurious provider condition");
        window.location.reload();
      }

      if (id && provider) {
        this._mode.next(modeFunc(id, provider));
      } else {
        const mode = this._mode.getValue();
        if (mode) {
          this._mode.next(undefined);
        }
      }
    });
  }

  get mode() {
    return this._mode;
  }
}

export class ParticipantModeContext<T> extends ParticipantContext {
  private _mode: ParticipantMode<T>;

  constructor(url: string, ns: string, modeFunc: Mode<T>) {
    super(url, ns);
    this._mode = new ParticipantMode<T>(
      this.participant.participant,
      this.provider,
      modeFunc
    );
  }

  get mode() {
    return this._mode.mode;
  }
}
