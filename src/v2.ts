import {
  Reshuffle,
  BaseConnector,
  EventConfiguration,
} from "reshuffle-base-connector";
import { nanoid } from "nanoid";
import Twitter, { RequestParameters } from "twitter-v2";

export type TwitterConnectorV2Options =
  | {
      consumer_key: string;
      consumer_secret: string;
    }
  | { bearer_token: string };

export type TwitterConnectorV2EventOptions = {
  endpoint: string;
  parameters?: RequestParameters;
};

export type TwitterV2Stream = ReturnType<Twitter["stream"]>;

export class TwitterV2Connector extends BaseConnector<
  TwitterConnectorV2Options,
  TwitterConnectorV2EventOptions
> {
  private client: Twitter;
  private streamsByEventId: {
    [eventId: string]: TwitterV2Stream;
  } = {};
  private logger: ReturnType<Reshuffle["getLogger"]>;

  constructor(app: Reshuffle, options: TwitterConnectorV2Options, id?: string) {
    super(app, options, id);
    this.client = new Twitter(options);
    this.logger = this.app.getLogger();
  }

  public on<T = Record<string, any>>(
    options: TwitterConnectorV2EventOptions,
    handler: (value: T) => void,
    eventId?: string
  ) {
    if (!eventId) {
      eventId = `TWITTER-V2/${this.id}/${eventId ? eventId : nanoid()}`;
    }
    const event: EventConfiguration = new EventConfiguration(
      eventId,
      this,
      options
    );
    this.eventConfigurations[event.id] = event;
    const { endpoint, parameters } = options;
    const stream = this.client.stream(endpoint, parameters);
    const streamHandler = async (stream: TwitterV2Stream) => {
      for await (const value of stream) {
        // @ts-ignore
        handler(value);
      }
    };
    void streamHandler(stream);
    this.streamsByEventId[eventId] = stream;
    return event;
  }

  public onStop() {
    Object.entries(this.streamsByEventId).forEach(([eventId, stream]) => {
      this.logger.log("info", `Closing the stream for event: ${eventId}`);
      stream.close();
    });
  }

  public get(...args: Parameters<Twitter["get"]>): ReturnType<Twitter["get"]> {
    return this.client.get(...args);
  }

  public post(
    ...args: Parameters<Twitter["post"]>
  ): ReturnType<Twitter["post"]> {
    return this.client.post(...args);
  }

  public delete(
    ...args: Parameters<Twitter["delete"]>
  ): ReturnType<Twitter["delete"]> {
    return this.client.delete(...args);
  }

  public sdk(): Twitter {
    return this.client;
  }
}
