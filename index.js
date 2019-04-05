const {exec} = require('child_process')
const path = require('path')
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
  angel.on('clean-gcr :keepAmount', async function (angel) {
    const packagejson = require(path.join(process.cwd(), 'package.json'))
    let repoRoot = await findSkeletonRoot()
    let loadCellInfo = require(path.join(repoRoot, 'cells/node_modules/lib/load-cell-info'))
    let cell = await loadCellInfo(packagejson.name)
    if (!cell.dna.registry || cell.dna.registry.indexOf('gcr.io') === -1) return
    let IMAGE = `${cell.dna.registry}/${cell.name}`
    let keepAmount = parseInt(angel.cmdData.keepAmount, 10)
    // get all images from gcr.io
    let {output} = await processExit(`gcloud container images list-tags ${IMAGE} --limit=999999 --format='json'`)
    let images = JSON.parse(output)
    // sort them by latest first
    images.sort(function (a, b) {
      return (new Date(b.timestamp.datetime)).valueOf() - (new Date(a.timestamp.datetime)).valueOf()
    })
    // remove latest keepAmount
    let leftimages = images.splice(0, keepAmount)
    // any image still in the array is eligable for removal
    await forEach(images, function (image) {
      return angel.exec(`gcloud container images delete -q --force-delete-tags "${IMAGE}@${image.digest}"`)
    })
    console.log(`gcr.io cleaned for ${IMAGE} done, left ${leftimages.length} images`)
  })
}
