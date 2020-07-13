'use strict'

// Chrome
let useChrome = typeof (browser) === 'undefined'
let hasConsole = typeof (console) !== 'undefined'

if (useChrome) document.body.classList.add('opera')
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
  formData.append('formatliste', imgItem['imgFormat'])
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

      if (uploadStatus['current'].name !== undefined) uploadPicture(uploadStatus['current'], false, uploadStatus['uploadIndex'].pop())
      else uploadPicture(uploadStatus['current'], true, -1)
    }
  } else window.requestAnimationFrame(processUploadQueue)
}

// ---------------------------------------------------------------------------------------------------
function resetStatus() {
  uploadStatus['cnt'] = 0
  uploadStatus['cntTotal'] = 0
  uploadStatus['current'] = null
  uploadStatus['uploadInProgres'] = false
  uploadStatus['uploadError'] = []
  uploadStatus['uploadQueue'] = []
  uploadStatus['uploadIndex'] = []

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

  let localFiles = document.querySelector('#uploadLocalInput').files
  resetStatus()
  uploadStatus['cntTotal'] = localFiles.length
  uploadStatus['uploadQueue'] = []
  uploadStatus['uploadIndex'] = []

  let uploadIndex = 1
  for (let fileEntry of localFiles) {
    uploadStatus['uploadQueue'].push(fileEntry)
    uploadStatus['uploadIndex'].push(uploadIndex)
    ++uploadIndex
  }

  if (uploadIndex !== 1) window.alert('Starting local upload.')
  else return
  uploadStatus['uploadQueue'] = uploadStatus['uploadQueue'].reverse()
  uploadStatus['uploadIndex'] = uploadStatus['uploadIndex'].reverse()

  window.requestAnimationFrame(processUploadQueue)
}

// ---------------------------------------------------------------------------------------------------
function collectRemotePictures() {
  if (PICFLASH_API_KEY === '') {
    window.alert('API key is missing.')
    return
  }

  if (!window.confirm('Do you want to start the remote upload?')) return

  let remoteFiles = document.querySelector('#uploadRemoteInput').value.match(/((http|https)\:[^\n]*\.(gif|jpeg|jpg|png|webm|mp4))/gi)
  if (remoteFiles === null) {
    window.alert('No remote files found in Remote upload area')
    return
  }

  window.alert('Starting remote upload')
  resetStatus()
  uploadStatus['cntTotal'] = remoteFiles.length

  for (let fileEntry of remoteFiles) uploadStatus['uploadQueue'].push(fileEntry)
  uploadStatus['uploadQueue'] = uploadStatus['uploadQueue'].reverse()

  window.requestAnimationFrame(processUploadQueue)
}

// ---------------------------------------------------------------------------------------------------
function uploadPicture(fileEntry, isRemote, localFileIndex) {
  let imgItem = {}
  if (isRemote) {
    imgItem = {
      'file': fileEntry,
      'isRemote': true,
      'imgRotation': PICFLASH_ROTATIONS[uploadListRemote.children[localFileIndex].querySelector('.fileRotation').value],
      'imgFormat': PICFLASH_FORMATS[uploadListRemote.children[localFileIndex].querySelector('.fileFormat').value],
      'noexif': uploadListRemote.children[localFileIndex].querySelector('.noExif').checked
    }
  }
  imgItem = {
    'file': fileEntry,
    'isRemote': isRemote,
    'imgRotation': PICFLASH_ROTATIONS[uploadListLocal.children[localFileIndex].querySelector('.fileRotation').value],
    'imgFormat': PICFLASH_FORMATS[uploadListLocal.children[localFileIndex].querySelector('.fileFormat').value],
    'noexif': uploadListLocal.children[localFileIndex].querySelector('.noExif').checked
  }

  console.log(imgItem)

  uploadStatus['current'] = null
  uploadStatus['uploadInProgess'] = false
  return

  let fileNameLower = fileEntry['name'] !== undefined ? fileEntry['name'].toLowerCase() : fileEntry.toLowerCase()
  if (fileNameLower.endsWith('.webm') || fileNameLower.endsWith('.mp4')) delete imgItem['noexif']

  uploadItem(PICFLASH_API_URL, 'POST', imgItem)
}

// ---------------------------------------------------------------------------------------------------
function createUploadDetails(file, uploadList) {
  let span = null
  let input = null
  let select = null
  let option = null
  let optionValue = '-1'

  let li = document.createElement('li')

  // --------------------------------------------------------------------------
  span = document.createElement('span')
  span.className = 'fileName'
  span.appendChild(document.createTextNode(file.name))
  li.appendChild(span)

  // --------------------------------------------------------------------------
  span = document.createElement('span')
  span.className = 'fileSize'
  span.appendChild(document.createTextNode((file.size / 1000000.0).toFixed(2).toString() + ' MB'))
  li.appendChild(span)

  // --------------------------------------------------------------------------
  span = document.createElement('span')
  input = document.createElement('input')
  input.className = 'noExif'
  input.type = 'checkbox'
  span.appendChild(input)
  li.appendChild(span)

  // --------------------------------------------------------------------------
  span = document.createElement('span')
  select = document.createElement('select')
  select.className = 'fileFormat'
  option = document.createElement('option')
  option.appendChild(document.createTextNode('Original size'))
  option.value = '-1'
  option.selected = 'selected'
  select.appendChild(option)

  optionValue = '-1'
  for (let format of Object.keys(PICFLASH_FORMATS)) {
    optionValue = (parseInt(optionValue) + 1).toString()
    format = PICFLASH_FORMATS[optionValue]

    if (format === undefined) break
    option = document.createElement('option')

    option.appendChild(document.createTextNode(format))
    option.value = optionValue
    select.appendChild(option)
  }
  span.appendChild(select)
  li.appendChild(span)

  // --------------------------------------------------------------------------
  span = document.createElement('span')
  select = document.createElement('select')
  select.className = 'fileRotation'
  option = document.createElement('option')
  option.appendChild(document.createTextNode('No rotation'))
  option.value = '-1'
  option.selected = 'selected'
  select.appendChild(option)

  optionValue = '-1'
  for (let format of Object.keys(PICFLASH_ROTATIONS)) {
    optionValue = (parseInt(optionValue) + 1).toString()
    format = PICFLASH_ROTATIONS[optionValue]

    if (format === undefined) break
    option = document.createElement('option')

    option.appendChild(document.createTextNode(format))
    option.value = optionValue
    select.appendChild(option)
  }
  span.appendChild(select)
  li.appendChild(span)

  // --------------------------------------------------------------------------
  uploadList.appendChild(li)
}

// ---------------------------------------------------------------------------------------------------
function clearUploadOptions(uploadList) {
  let size = uploadList.children.length
  for (let index = 1; index < size; ++index) uploadList.removeChild(uploadList.children[1])
}

// ---------------------------------------------------------------------------------------------------
function readLocalPictures(evt) {
  clearUploadOptions(uploadListLocal)
  for (let file of evt.target.files) createUploadDetails(file, uploadListLocal)

  if (uploadListLocal.children.length > 0) {
    let noData = uploadListLocal.querySelector('.noData')
    if (noData !== null) {
      uploadListLocal.removeChild(noData)
    } else if (uploadListLocal.children.length <= 1) {
      let li = document.createElement('li')
      li.appendChild(document.createTextNode('No upload data'))
      li.className = 'noData'
      uploadListLocal.appendChild(li)
    }
  }
}

// ---------------------------------------------------------------------------------------------------
function readRemotePictures(evt) {
  let remoteUploadData = evt.target.value.match(/((http|https)\:[^\n]*\.(gif|jpeg|jpg|png|webm|mp4))/gi)

  clearUploadOptions(uploadListRemote)

  if (remoteUploadData !== null) {
    for (let link of remoteUploadData) {
      let linkName = link.split('/')
      let file = {'name': linkName[linkName.length - 1], 'size': 0}
      createUploadDetails(file, uploadListRemote)
    }
  }

  if (uploadListRemote.children.length > 0) {
    let noData = uploadListRemote.querySelector('.noData')
    if (noData !== null) {
      uploadListRemote.removeChild(noData)
    } else if (uploadListRemote.children.length <= 1) {
      let li = document.createElement('li')
      li.appendChild(document.createTextNode('No upload data'))
      li.className = 'noData'
      uploadListRemote.appendChild(li)
    }
  }
}

// ---------------------------------------------------------------------------------------------------
let PICFLASH_API_KEY = ''
let PICFLASH_API_URL = 'https://www.picflash.org/tool.php'
let PICFLASH_USER_AGENT = 'pic2up'
let PICFLASH_FORMATS = {
  '-1': 'og',
  '0': '80x80',
  '1': '100x75',
  '2': '100x100',
  '3': '150x112',
  '4': '468x60',
  '5': '400x400',
  '6': '320x240',
  '7': '640x480',
  '8': '800x600',
  '9': '1024x768',
  '10': '1280x1024',
  '11': '1600x1200'
}
let PICFLASH_ROTATIONS = {
  '-1': '00',
  '0': '90',
  '1': '180',
  '2': '270'
}

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
let uploadListLocal = document.querySelector('#uploadListLocal')
let uploadListRemote = document.querySelector('#uploadListRemote')


// ---------------------------------------------------------------------------------------------------
document.querySelector('#uploadLocalInput').addEventListener('change', readLocalPictures)
document.querySelector('#uploadRemoteInput').addEventListener('keyup', readRemotePictures)
document.querySelector('#submitLocalUpload').addEventListener('click', collectLocalPictures)
document.querySelector('#submitRemoteUpload').addEventListener('click', collectRemotePictures)
document.querySelector('#clearUploadButton').addEventListener('click', clearUploadData)
apiKey.addEventListener('keyup', setApiKey)

// ---------------------------------------------------------------------------------------------------
readRuntimeData()
document.querySelector('#uploadLocalInput').dispatchEvent(new Event('change'))
document.querySelector('#uploadRemoteInput').dispatchEvent(new Event('keyup'))