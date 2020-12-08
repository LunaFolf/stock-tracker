const fs = require('fs')
const YAML = require('yaml')

const fetch = require('node-fetch')
const HttpsProxyAgent = require('https-proxy-agent')

const minutesToWait = 1.5
const waitTimeSeconds = minutesToWait * 60
var countdown = 0

console.clear()

var configFile = null
try {
  configFile = fs.readFileSync('./config.yml', 'utf8')
} catch (err) {
  configFile = fs.readFileSync('./config.example.yml', 'utf8')
}
const config = configFile ? YAML.parse(configFile) : {}

if (!config.sources) throw new Error('config.sources needs to be set!')

var outcome = []
var proxies = [...config.proxies]

function getOutcome() {
  console.log('refreshing')
  if (!proxies.length) proxies = [...config.proxies]
  var proxyToUse = proxies.pop()
  var proxy = 'http://' + proxyToUse
  var agent = null
  if (proxyToUse !== 'local') agent = HttpsProxyAgent(proxy)
  return new Promise((resolve, reject) => {
    for (var [sourceName, details] of Object.entries(config.sources)) {
      const constantSourceName = sourceName
      const url = details.url
      fetch(url, {
        timeout: 5000,
        redirect: 'follow',
        follow: 20,
        agent
        })
        .then(async res => {
          console.log('response from ' + constantSourceName + '...')
          response = await res.text()
          const instock = !config.badLines.some(line => response.toLowerCase().includes(line.toLowerCase()))
          const robotCheck = config.robotCheck.some(line => response.toLowerCase().includes(line.toLowerCase()))
          outcome.push({
            sourceName: constantSourceName,
            instock: robotCheck ? false : instock,
            robotCheck,
            url
          })
        })
        .catch(err => {
          console.log(err.type + ' from ' + constantSourceName + '...')
          outcome.push({
            sourceName: constantSourceName,
            instock: false,
            robotCheck: false,
            url,
            error: err.type
          })
        })
        .finally(() => {
          if (outcome.length >= Object.keys(config.sources).length) resolve(outcome)
        })
    }
  })
}

var now = new Date()

function drawTable() {
  process.stdout.write('\033[2;0H')
  console.table(outcome.map(o => {
    var print = { ...o }
    delete print.url
    return print
  }))
}

function main() {
  setTimeout(async function () {
    process.stdout.write('\033[0;0H')
    countdown = Math.max(countdown - 1, 0)
    process.stdout.write('Next refresh in: ' + (countdown < 10 ? `0${countdown}` : countdown) + '\n')
    if (countdown <= 0) {
      outcome = []
      await getOutcome()
        .then(resOut => {
          outcome = resOut
          countdown = waitTimeSeconds
          now = new Date()
        })
        .finally(() => {
          drawTable()
        })
    } else {
      drawTable()
    }

    process.stdout.write('\033[' + (Object.keys(config.sources).length + 6) + ';0H')
    outcome.forEach(source => {
      if (source.instock && !source.robotCheck) {
        console.log(`[${now.toTimeString()}] ✅ (${source.sourceName}) In-stock! | ${source.url}`)
      } else if (source.robotCheck) {
        console.log(`[${now.toTimeString()}] 🤖 (${source.sourceName}) Stopped by Robot`)
      }
    })

    main()
  }, 1000)
}

main()