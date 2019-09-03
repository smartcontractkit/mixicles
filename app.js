const express = require('express')
const bodyParser = require('body-parser')
const ethers = require('ethers')
const uuid = require('uuid/v4')
const utils = ethers.utils

const app = {}
app.deals = {}
const server = express()
server.use(bodyParser.json())

// TODO: We need to use a fresh key per contract to avoid replay vulnerabilities.
// Currently we use the same key `app.key` everywhere.

server.post('/propose_deal', async (req, res) => {
  deal = { id: Object.keys(app.deals).length }

  deal.paramsHex = req.body.dealParams
  deal.paramsHash = ethers.utils.keccak256(
    ethers.utils.arrayify(deal.paramsHex)
  )
  deal.signature = await app.key.signingKey.signDigest(
    ethers.utils.arrayify(deal.paramsHash)
  )
  deal.signatureParts = utils.splitSignature(deal.signature)
  deal.outcomes = req.body.outcomes

  app.deals[deal.id] = deal
  res.status(200).json(deal)
})

server.post('/resolve_deal', (req, res) => {
  const deal = app.deals[req.body.id]

  res.status(200).json({
    result: deal.outcomes['0'].tag,
    error: null
  })
})

app.start = (port, key) => {
  app.key = new ethers.Wallet(key)
  app.server = server.listen(port)
}

app.stop = () => {
  app.server.close()
}

module.exports = app
