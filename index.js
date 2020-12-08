const fs = require('fs')
const https = require('https')
const YAML = require('yaml')
const fetch = require('node-fetch')

console.clear()

var configFile = null
try {
  configFile = fs.readFileSync('./config.yml', 'utf8')
} catch (err) {
  configFile = fs.readFileSync('./config.example.yml', 'utf8')
}
const config = configFile ? YAML.parse(configFile) : {}

if (!config.sources || !config.sources.length) throw new Error('config.sources array needs to be set!')

for (var sourceIndex in config.sources) {
  const url = config.sources[sourceIndex]
  fetch(url)
    .then(async res => {
      response = await res.text()
      if (config.badLines.some(line => {
        return response.includes(line)
      })) {
        console.log('out of stock')
      } else {
        console.log('might be good actually')
      }
    })
}