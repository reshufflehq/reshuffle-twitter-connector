import fetch from 'node-fetch'
import querystring from 'querystring'
import {
  CoreConnector,
  CoreEventHandler,
  Options,
  Reshuffle,
} from './CoreConnector'

interface EventOptions {
  follow?: string
  search?: string
}

interface Cursor {
  lastSeen: string
}

export class TwitterConnector extends CoreConnector {
  private authorization?: string

  constructor(app: Reshuffle, options: Options, id?: string) {
    super(app, options, id)
    if (!/^[a-zA-Z0-9]{25}$/.test(options.customerKey)) {
      throw new Error(`Invalid customer key: ${options.customerKey}`)
    }
    if (!/^[a-zA-Z0-9]{50}$/.test(options.customerSecret)) {
      throw new Error(`Invalid customer secret: ${options.customerSecret}`)
    }
  }

  private async authorize() {
    if (!this.authorization) {
      const user = `${this.options.customerKey}:${this.options.customerSecret}`
      const basic = Buffer.from(user).toString('base64')

      const params = new URLSearchParams()
      params.append('grant_type', 'client_credentials')

      const res = await fetch('https://api.twitter.com/oauth2/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      })

      if (res.status !== 200) {
        throw new Error(`Twitter authorization error: ${
          res.status} ${res.statusText}`)
      }

      const token = await res.json()
      if (
        !token ||
        token.token_type !== 'bearer' ||
        !/^[a-zA-Z0-9=\+]{110}$/.test(decodeURIComponent(token.access_token))
      ) {
        throw new Error('Twitter authorization error')
      }

      this.authorization = `Bearer ${token.access_token}`
    }
    return this.authorization
  }

  private async request(
    method: string,
    path: string,
    qs?: Record<string, any>,
    body?: Record<string, any>,
  ) {
    const url = `https://api.twitter.com/1.1/${path}` +
      (qs ? `?${querystring.stringify(qs)}` : '')

    const opts: any = {
      method,
      headers: { Authorization: await this.authorize() },
    }
    if (body) {
      opts.body = JSON.stringify(body)
      opts.headers['Content-Type'] = 'application/json'
    }

    const res = await fetch(url, opts)

    if (res.status !== 200) {
      throw new Error(`Twitter API error: ${res.status} ${res.statusText}`)
    }

    const data: any = await res.json()
    if (data.errors || data.error) {
      const errors = data.errors || data.error
      console.error('Twitter error:', errors)
      throw new Error(`Twitter error: ${errors.code} ${errors.message}`)
    }

    return data
  }

  // Events /////////////////////////////////////////////////////////

  public on(
    options: EventOptions,
    handler: CoreEventHandler,
    eventId?: string,
  ) {
    let desc
    if (options.follow !== undefined && options.search !== undefined) {
      throw new Error('Both follow and search specified')
    } else if (options.follow !== undefined) {
      const match = (options.follow || '').match(/^@?(\w{1,15})$/)
      const handle = match && match[1]
      if (!handle) {
        throw new Error(`Invalid follow user: ${options.follow}`)
      }
      desc = `follow:${handle}`
    } else if (options.search !== undefined) {
      const q = typeof options.search === 'string' ? options.search.trim() : ''
      if (q.length === 0) {
        throw new Error(`Invalid search query: ${options.search}`)
      }
      desc = `search:${q}`
    } else {
      throw new Error('Neither follow or search specified')
    }
    return this.eventManager.addEvent({ desc }, handler, eventId || desc)
  }

  protected async onInterval() {
    const events = this.eventManager.mapEvents(
      (ec) => ec.options.desc
    ) as string[]

    for (const desc of events) {
      const [type, what] = desc.split(':')
      const tweets = await (this as any)[type](desc, what)
      await this.eventManager.fire(
        (ec) => ec.options.desc === desc,
        { tweets },
      )
    }
  }

  protected follow(desc: string, handle: string) {
    return this.getRecentTweets(
      desc,
      200,
      'statuses/user_timeline.json',
      { screen_name: handle },
    )
  }

  protected search(desc: string, query: string) {
    return this.getRecentTweets(
      desc,
      100,
      'search/tweets.json',
      { q: query },
    )
  }

  protected async getRecentTweets(
    cursorName: string,
    limit: number,
    path: string,
    params: Record<string, string>
  ): Promise<any[]> {
    const tweets: any[] = []

    const loadTweetsFromCursor = async (cursor?: Cursor) => {
      const since = cursor && BigInt(cursor.lastSeen)
      let max: BigInt | undefined
      for (;;) {
        const res = await this.GET(path, {
          ...params,
          limit,
          ...(max ? { max_id: max.toString() } : {}),
          ...(since ? { since_id: since.toString() } : {}),
        })
        tweets.unshift(...(res.statuses || res).reverse())
        if (!since || (res.statuses || res).length < limit) {
          return
        }
        max = BigInt(res[res.length - 1].id_str) - BigInt(1)
      }
    }
    await this.store.update(cursorName, async (oldCursor) => {
      await loadTweetsFromCursor(oldCursor)
      return tweets.length ?
        { lastSeen: tweets[tweets.length - 1].id_str } :
        undefined
    })

    return tweets
  }

  // REST ///////////////////////////////////////////////////////////

  public GET(path: string, qs?: Record<string, any>) {
    return this.request('GET', path, qs)
  }

  public POST(
    path: string,
    qs?: Record<string, any>,
    body?: Record<string, any>,
  ) {
    return this.request('POST', path, qs, body)
  }
}

export * from './v2'