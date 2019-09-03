const app = require('./app.js')

const port = process.env.MIXICLES_PORT || 3000
const key =
  process.env.MIXICLES_KEY ||
  '0x388c684f0ba1ef5017716adb5d21a053ea8e90277d0868337519f97bede61418'

console.log(`starting server on port ${port}`)
app.start(port, key)
