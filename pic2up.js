'use strict'

// Chrome
let useChrome = typeof (browser) === 'undefined'
let hasConsole = typeof (console) !== 'undefined'

// ----------------------------------------------------------------------------
function setApiKey(evt) {
  runData['apikey'] = evt.target.value.trim()
  PICFLASH_API_KEY = runData['apikey']
  updateRuntimeData()
}

function readRuntimeData() {
  apiKey.value = ''
  if (useChrome) {
    chrome.storage.local.get(function (data) {
      if (data === undefined) return
      if (data['uploadLog'] !== undefined) uploadLog.value = data['uploadLog']
      if (data['uploadDetails'] !== undefined) uploadDetails.value = data['uploadDetails']
      if (data['apikey'] !== undefined) {
        apiKey.value = data['apikey']
        PICFLASH_API_KEY = data['apikey']
      }

      return true
    })

    return
  }

  browser.storage.local.get().then(function (data) {
    if (data['uploadLog'] !== undefined) uploadLog.value = data['uploadLog']
    if (data['uploadDetails'] !== undefined) uploadDetails.value = data['uploadDetails']
    if (data['uploadStatus'] !== undefined) console.log(data['uploadStatus'])
    if (data['apikey'] !== undefined) {
      apiKey.value = data['apikey']
      PICFLASH_API_KEY = data['apikey']
    }
  })
}

// ---------------------------------------------------------------------------------------------------
function clearUploadData() {
  if (!window.confirm('Should all upload history be cleared?')) return
  uploadLog.value = ''
  uploadDetails.value = ''

  uploadCurrentFile.value = ''
  uploadProgressPercent.value = ''
  uploadProgressFiles.value = ''

  PICFLASH_API_KEY = apiKey.value
  runData['apikey'] = PICFLASH_API_KEY

  runData['uploadLog'] = ''
  runData['uploadDetails'] = ''
  runData['uploadStatus'] = ''

  if (useChrome) chrome.storage.local.set(runData)
  else browser.storage.local.set(runData)

  window.alert('Successfully cleared upload history.')
}

// ---------------------------------------------------------------------------------------------------
function updateRuntimeData() {
  runData['uploadLog'] = uploadLog.value
  runData['uploadDetails'] = uploadDetails.value
  runData['uploadStatus'] = uploadStatus

  if (useChrome) chrome.storage.local.set(runData)
  else browser.storage.local.set(runData)
}

// ---------------------------------------------------------------------------------------------------
function uploadItem(url, method, imgItem) {
  function handleXMLRequestStatus (evt) {
    if (evt.target.readyState === 4 && evt.target.status === 200) {
      ++uploadStatus['cnt']
      uploadLog.value += 'Uploaded succesfully: "' + (uploadStatus['current'].name !== undefined ? uploadStatus['current'].name : uploadStatus['current']) + '"\n'
      uploadDetails.value += (uploadStatus['current'].name !== undefined ? uploadStatus['current'].name : uploadStatus['current']) + ' : ' + JSON.stringify(JSON.parse(evt.target.responseText)) + '\n'
      uploadProgressFiles.value = uploadStatus['cnt'].toString() + ' of ' + uploadStatus['cntTotal'].toString() + ' files'
      document.title = originalTitle
      uploadStatus['current'] = null
      uploadStatus['uploadError'].push(null)

      updateRuntimeData()
      uploadStatus['uploadInProgess'] = false
    } else if (evt.target.readyState === 4 && evt.target.status !== 200) {
      document.title = originalTitle
      uploadStatus['uploadError'].push(evt.target.responseText)

      updateRuntimeData()
      uploadStatus['uploadInProgess'] = false
    }
  }

  let countPos = 0
  function handleXMLRequestProgress (evt) {
    document.title = originalTitle + ': In upload'
    for (let x = 0; x < countPos; ++x) document.title += '.'
    if (++countPos > 3) countPos = 0
    uploadProgressPercent.value = (evt.loaded / 1000000.0).toFixed(2).toString() + ' of ' + (evt.total / 1000000.0).toFixed(2).toString() + ' MB ( ' + ((evt.loaded / evt.total) * 100).toFixed(2) .toString() + '% )'
  }

  let formData = new FormData();
  if (imgItem['isRemote'] === true) formData.append('url[]', imgItem['file']);
  else formData.append('Datei[]', imgItem['file']);

  formData.append('useragent', PICFLASH_USER_AGENT)
  formData.append('apikey', PICFLASH_API_KEY)
  formData.append('formatliste', 'og')
  formData.append('userdrehung', imgItem['imgRotation'])
  if (imgItem['noexif'] !== undefined) formData.append('noexif', true)

  let request = new XMLHttpRequest
  request.addEventListener('readystatechange', handleXMLRequestStatus)
  request.upload.addEventListener('progress', handleXMLRequestProgress)
  request.open(method, url)
  request.send(formData)
}

// ---------------------------------------------------------------------------------------------------
function processUploadQueue() {
  if (!uploadStatus['uploadInProgess']) {
    uploadStatus['uploadInProgess'] = true
    uploadStatus['current'] = uploadStatus['uploadQueue'].pop()
    if (uploadStatus['current'] !== undefined) {
      uploadProgressFiles.value = uploadStatus['cnt'].toString() + ' of ' + uploadStatus['cntTotal'].toString() + ' files'
      uploadCurrentFile.value = 'File in upload: ' + (uploadStatus['current'].name !== undefined ? uploadStatus['current'].name : uploadStatus['current'])

      if (uploadStatus['current'].name !== undefined) uploadPicture(uploadStatus['current'], false)
      else uploadPicture(uploadStatus['current'], true)
    }
  }

  window.requestAnimationFrame(processUploadQueue)
}

// ---------------------------------------------------------------------------------------------------
function resetStatus() {
  uploadStatus['cnt'] = 0
  uploadStatus['cntTotal'] = 0
  uploadStatus['current'] = null
  uploadStatus['uploadInProgres'] = false
  uploadStatus['uploadError'] = []
  uploadStatus['uploadQueue'] = []

  uploadCurrentFile.value = ''
  uploadProgressPercent.value = ''
  uploadProgressFiles.value = ''

  document.title = originalTitle
}

// ---------------------------------------------------------------------------------------------------
function collectLocalPictures() {
  if (PICFLASH_API_KEY === '') {
    window.alert('API key is missing.')
    return
  }

  if (!window.confirm('Do you want to start the local upload?')) return
  window.alert('Starting local upload.')

  let localFiles = document.querySelector('#uploadLocalInput').files
  resetStatus()
  uploadStatus['cntTotal'] = localFiles.length

  for (let fileEntry of localFiles) uploadStatus['uploadQueue'].push(fileEntry)
  uploadStatus['uploadQueue'] = uploadStatus['uploadQueue'].reverse()

  window.requestAnimationFrame(processUploadQueue)
}

// ---------------------------------------------------------------------------------------------------
function collectRemotePictures() {
  if (PICFLASH_API_KEY === '') {
    window.alert('API key is missing.')
    return
  }

  if (!window.confirm('Do you want to start the remote upload?')) return
  window.alert('Starting remote upload')

  let remoteFiles = document.querySelector('#uploadRemoteInput').value.match(/((http|https)\:[^\n]*\.(gif|jpeg|jpg|png|web|mp4))/gi)
  if (remoteFiles === null) return
  resetStatus()
  uploadStatus['cntTotal'] = remoteFiles.length

  for (let fileEntry of remoteFiles) uploadStatus['uploadQueue'].push(fileEntry)
  uploadStatus['uploadQueue'] = uploadStatus['uploadQueue'].reverse()

  window.requestAnimationFrame(processUploadQueue)
}

// ---------------------------------------------------------------------------------------------------
function uploadPicture(fileEntry, isRemote) {
  let imgItem = {
    'file': fileEntry,
    'isRemote': isRemote,
    'imgRotation': '00',
    'noexif': true
  }

  let fileNameLower = fileEntry['name'] !== undefined ? fileEntry['name'].toLowerCase() : fileEntry.toLowerCase()
  if (fileNameLower.endsWith('.webm') || fileNameLower.endsWith('.mp4')) delete imgItem['noexif']

  uploadItem(PICFLASH_API_URL, 'POST', imgItem)
}

// ---------------------------------------------------------------------------------------------------
let PICFLASH_API_KEY = ''
let PICFLASH_API_URL = 'https://www.picflash.org/tool.php'
let PICFLASH_USER_AGENT = 'pic2up'
// ---------------------------------------------------------------------------------------------------
let uploadStatus = { 'cnt': 0, 'cntTotal': 0, 'uploadInProgres': false, 'uploadQueue': [], 'current': null}
let runData = { 'apikey': PICFLASH_API_KEY }
let originalTitle = document.title

let uploadCurrentFile = document.querySelector('#uploadCurrentFile')
let uploadProgressPercent = document.querySelector('#uploadProgressPercent')
let uploadProgressFiles = document.querySelector('#uploadProgressFiles')
let uploadLog = document.querySelector('#uploadLog')
let uploadDetails = document.querySelector('#uploadDetails')
let apiKey = document.querySelector('#apikey')

// ---------------------------------------------------------------------------------------------------
document.querySelector('#submitLocalUpload').addEventListener('click', collectLocalPictures)
document.querySelector('#submitRemoteUpload').addEventListener('click', collectRemotePictures)
document.querySelector('#clearUploadButton').addEventListener('click', clearUploadData)

apiKey.addEventListener('keyup', setApiKey)
readRuntimeData()
