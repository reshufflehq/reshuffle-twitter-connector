const { Reshuffle } = require('reshuffle')
const { TwitterConnector } = require('reshuffle-twitter-connector')

;(async () => {
  const app = new Reshuffle()
  const twitter = new TwitterConnector(app, {
    customerKey: process.env.TWITTER_CONSUMER_KEY,
    customerSecret: process.env.TWITTER_CONSUMER_SECRET,
  })

  twitter.on({ follow: 'taylorswift13' }, async (event, app) => {
    for (const tweet of event.tweets) {
      console.log(tweet.text)
    }
  })

  app.start(8000)

})().catch(console.error)
