'use strict'

const callbackify = require('./lib/callbackify')
const { collectify, pullify, concatify } = require('./lib/iterable')

module.exports = config => {
  const add = require('./add')(config)
  const cat = require('./cat')(config)
  const ls = require('./ls')(config)
  const ping = require('./ping')(config)

  return {
    add: callbackify(collectify(add), { minArgs: 1 }),
    addPullStream: pullify.transform(add),
    addFromStream: callbackify(collectify(add), { minArgs: 1 }),
    addFromURL: callbackify(collectify(require('./add-from-url')(config))),
    bitswap: {
      stat: callbackify(require('./bitswap/stat')(config)),
      wantlist: callbackify(require('./bitswap/wantlist')(config))
    },
    block: {
      get: callbackify(require('./block/get')(config)),
      put: callbackify(require('./block/put')(config)),
      stat: callbackify(require('./block/stat')(config))
    },
    cat: callbackify(concatify(cat)),
    catPullStream: pullify.source(cat),
    ls: callbackify(collectify(ls)),
    lsPullStream: pullify.source(ls),
    id: callbackify(require('./id')(config)),
    ping: callbackify(collectify(ping)),
    pingPullStream: pullify.source(ping),
    swarm: {
      connect: callbackify(require('./swarm/connect')(config)),
      peers: callbackify(require('./swarm/peers')(config))
    },
    version: callbackify(require('./version')(config))
  }
}
