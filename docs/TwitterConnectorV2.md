# reshuffle-twitter-connector

`npm install reshuffle-twitter-connector`

_ES6 import_: `import { TwitterConnectorV2 } from 'reshuffle-twitter-connector'`

This is a [Reshuffle](https://reshuffle.com) connector that provides an interface to the Twitter V2 API.

The following example adds a search rule and streams the results

```js
const { Reshuffle } = require('reshuffle')
const { TwitterV2Connector } = require('reshuffle-twitter-connector')

const app = new Reshuffle()

const twitterConnector = new TwitterV2Connector(app, { bearer_token: process.env.BEARER_TOKEN })

;(async () => {
  await twitterConnector.post('tweets/search/stream/rules', {
    add: [{ value: '#clouds has:images' }],
  })
  twitterConnector.on(
    {
      endpoint: 'tweets/search/stream',
      parameters: {
        'tweet.fields': 'created_at',
        expansions: 'author_id',
        'user.fields': 'created_at',
      },
    },
    (event) => console.log(event),
  )
  app.start()
})()
```

#### Table of Contents

[Configuration options](#Configuration-Options)

[TypeScript Types](#TypeScript-Types)

_Connector actions_:

[get](#get) Get 

[post](#post) Post

[delete](#delete) Delete

##### Configuration options

```js
const app = new Reshuffle()
const connector = new TwitterConnectorV2(app, { bearer_token: 'your bearer token' })
```

or

```js
const app = new Reshuffle()
const connector = new TwitterConnectorV2(app, { consumer_key: 'your consumer key', consumer_secret: 'your consumer secret' })
```

Credentials can be created by creating a developer account at https://developer.twitter.com/en/docs/developer-portal/overview

See the `Credentials` interface exported from the connector for details.

##### TypeScript types

The following types are exported from the connector:

- **interface TwitterConnectorV2Options** Twitter Connector V2 Options
- **interface TwitterConnectorV2EventOptions** Twitter Connector V2 Event Options

#### Connector actions

##### get

Send a get request to the Twitter API V2

```ts
async get(): Promise<any>
```

##### post

Send a post request to the Twitter API V2

```ts
async post(): Promise<any>
```

##### delete

Send a delete request to the Twitter API V2

```ts
async delete(): Promise<any>
```