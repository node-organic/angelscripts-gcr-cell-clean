const {exec} = require('child_process')
const path = require('path')
const moment = require('moment')
const findSkeletonRoot = require('organic-stem-skeleton-find-root')
const {forEach} = require('p-iteration')
const processExit = function (cmd) {
  return new Promise((resolve, reject) => {
    let output = ''
    let child = exec(cmd)
    child.stdout.on('data', (chunk) => {
      output += chunk.toString()
    })
    child.on('close', () => {
      resolve({output})
    })
  })
}

module.exports = function (angel) {
  angel.on('clean-gcr :before :format', async function (angel) {
    const packagejson = require(path.join(process.cwd(), 'package.json'))
    let repoRoot = await findSkeletonRoot()
    let loadCellInfo = require(path.join(repoRoot, 'cells/node_modules/lib/load-cell-info'))
    let cell = await loadCellInfo(packagejson.name)
    if (!cell.dna.registry || cell.dna.registry.indexOf('gcr.io') === -1) return
    let IMAGE = `${cell.dna.registry}/${cell.name}`
    let DATE = moment().subtract(angel.cmdData.before, angel.cmdData.format).format('YYYY-MM-DD')
    let {output} = await processExit(`gcloud container images list-tags ${IMAGE} --limit=999999 --sort-by=TIMESTAMP --filter="timestamp.datetime < '${DATE}'" --format='get(digest)'`)
    let containerDigests = output.split('\n').filter(v => v)
    await forEach(containerDigests, function (digest) {
      return angel.exec(`gcloud container images delete -q --force-delete-tags "${IMAGE}@${digest}"`)
    })
    console.log(`gcr.io cleaned for ${IMAGE} done`)
  })
}
