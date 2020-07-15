'use strict'

// Chrome
let useChrome = typeof (browser) === 'undefined'
let hasConsole = typeof (console) !== 'undefined'

if (useChrome) document.body.classList.add('opera')

// ----------------------------------------------------------------------------
function setApiKey(evt) {
  runData['apikey'] = apiKey.value.trim()
  PICFLASH_API_KEY = runData['apikey']
  updateRuntimeData()
}

// ----------------------------------------------------------------------------
function readRuntimeData() {
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

  runData['uploadLog'] = ''
  runData['uploadDetails'] = ''
  runData['uploadStatus'] = ''

  uploadLocalInput.value = ''
  uploadListRemote.value = ''
  uploadRemoteInput.value = ''

  document.querySelector('#uploadLocalInput').dispatchEvent(new Event('change'))
  document.querySelector('#uploadRemoteInput').dispatchEvent(new Event('keyup'))
  if (useChrome) chrome.storage.local.set(runData)
  else browser.storage.local.set(runData)

  window.alert('Successfully cleared upload history.')
}

// ---------------------------------------------------------------------------------------------------
function updateRuntimeData() {
  runData['uploadLog'] = uploadLog.value
  runData['uploadDetails'] = uploadDetails.value
  runData['uploadStatus'] = uploadStatus
  runData['apikey'] = apiKey.value

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
      uploadStatus['uploadError'].push(null)
      updateRuntimeData()
      uploadStatus['uploadInProgress'] = false
    } else if (evt.target.readyState === 4 && evt.target.status !== 200) {
      document.title = originalTitle
      uploadStatus['uploadError'].push(evt.target.responseText)

      updateRuntimeData()
      uploadStatus['uploadInProgress'] = false
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
  if (imgItem['noexif'] === true) formData.append('noexif', true)

  let request = new XMLHttpRequest
  request.addEventListener('readystatechange', handleXMLRequestStatus)
  request.upload.addEventListener('progress', handleXMLRequestProgress)
  request.open(method, url)
  request.send(formData)
}

// ---------------------------------------------------------------------------------------------------
function processUploadQueue() {
  if (!uploadStatus['uploadInProgress']) {
    uploadStatus['uploadInProgress'] = true
    uploadStatus['current'] = uploadStatus['uploadQueue'].pop()
    if (uploadStatus['current'] !== undefined) {
      uploadStatus['uploadInProgress'] = true
      uploadProgressFiles.value = uploadStatus['cnt'].toString() + ' of ' + uploadStatus['cntTotal'].toString() + ' files'
      uploadCurrentFile.value = 'File in upload: ' + (uploadStatus['current'].name !== undefined ? uploadStatus['current'].name : uploadStatus['current'])

      if (uploadStatus['current'].name !== undefined) uploadPicture(uploadStatus['current'], false, uploadStatus['uploadIndex'].pop())
      else uploadPicture(uploadStatus['current'], true, uploadStatus['uploadIndex'].pop())
      window.requestAnimationFrame(processUploadQueue)
    } else uploadStatus['uploadInProgress'] = false
  } else window.requestAnimationFrame(processUploadQueue)
}

// ---------------------------------------------------------------------------------------------------
function resetStatus() {
  uploadStatus['cnt'] = 0
  uploadStatus['cntTotal'] = 0
  uploadStatus['current'] = null
  uploadStatus['uploadInProgress'] = false
  uploadStatus['uploadError'] = []
  uploadStatus['uploadQueue'] = []
  uploadStatus['uploadIndex'] = []

  uploadCurrentFile.value = ''
  uploadProgressPercent.value = ''
  uploadProgressFiles.value = ''

  uploadLocalInput.value = ''
  uploadListRemote.value = ''
  document.querySelector('#uploadLocalInput').dispatchEvent(new Event('change'))
  document.querySelector('#uploadRemoteInput').dispatchEvent(new Event('keyup'))

  document.title = originalTitle
}

// ---------------------------------------------------------------------------------------------------
function collectLocalPictures() {
  if (PICFLASH_API_KEY === '') {
    window.alert('API key is missing.')
    return
  }

  if (uploadStatus['uploadInProgress'] === true) {
    window.alert('A upload is already in progress. Please wait until the operation finishes.')
    return
  }

  if (!window.confirm('Do you want to start the local upload?')) return

  let localFiles = document.querySelector('#uploadLocalInput').files
  uploadStatus['cnt'] = 0
  uploadStatus['cntTotal'] = localFiles.length
  uploadStatus['uploadQueue'] = []
  uploadStatus['uploadIndex'] = []
  uploadStatus['uploadInProgress'] = false
  uploadStatus['current'] = undefined

  let uploadIndex = 1
  for (let fileEntry of localFiles) {
    uploadStatus['uploadQueue'].push(fileEntry)
    uploadStatus['uploadIndex'].push(uploadIndex)
    ++uploadIndex
  }

  if (uploadIndex !== 1) window.alert('Starting local upload.')
  else {
    window.alert('No files for upload selected.')
    return
  }
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

  if (uploadStatus['uploadInProgress'] === true) {
    window.alert('A upload is already in progress. Please wait until the operation finishes.')
    return
  }

  if (!window.confirm('Do you want to start the remote upload?')) return

  let remoteFiles = document.querySelector('#uploadRemoteInput').value.match(/((http|https)\:[^\n]*\.(gif|jpeg|jpg|png|webm|mp4))/gi)
  if (remoteFiles === null) {
    window.alert('No remote files found in remote upload list.')
    return
  }

  window.alert('Starting remote file upload.')
  uploadStatus['cnt'] = 0
  uploadStatus['cntTotal'] = remoteFiles.length
  uploadStatus['uploadQueue'] = []
  uploadStatus['uploadIndex'] = []
  uploadStatus['uploadInProgress'] = false
  uploadStatus['current'] = undefined

  let uploadIndex = 1
  for (let fileEntry of remoteFiles) {
    uploadStatus['uploadQueue'].push(fileEntry)
    uploadStatus['uploadIndex'].push(uploadIndex)
    ++uploadIndex
  }

  uploadStatus['uploadQueue'] = uploadStatus['uploadQueue'].reverse()
  uploadStatus['uploadIndex'] = uploadStatus['uploadIndex'].reverse()

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
  } else {
    imgItem = {
      'file': fileEntry,
      'isRemote': false,
      'imgRotation': PICFLASH_ROTATIONS[uploadListLocal.children[localFileIndex].querySelector('.fileRotation').value],
      'imgFormat': PICFLASH_FORMATS[uploadListLocal.children[localFileIndex].querySelector('.fileFormat').value],
      'noexif': uploadListLocal.children[localFileIndex].querySelector('.noExif').checked
    }
  }

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
function checkRemoteUploads(evt) {
  function handleXMLRequestStatus (evt) {

    if (evt.target.readyState === 4 && evt.target.status === 200) {
      let size = evt.target.getResponseHeader('content-length')
      if (size === null) size = '0.00 MB'
      else size = (size / 1000000.0).toFixed(2).toString() + ' MB'
      uploadListRemote.children[evt.target['listIndex']].children[1].textContent = size
    } else if (evt.target.status != 0) {
      let size = '0.00 MB'
      uploadListRemote.children[evt.target['listIndex']].children[1].textContent = size
    }
  }

  let remoteUploadData = uploadRemoteInput.value.match(/((http|https)\:[^\n]*\.(gif|jpeg|jpg|png|webm|mp4))/gi)
  if (remoteUploadData === null) return

  let index = 1
  for (let link of remoteUploadData) {
    let request = new XMLHttpRequest
    request.addEventListener('readystatechange', handleXMLRequestStatus)
    request['listIndex'] = index
    request.open('HEAD', link)
    request.send()
    ++index
  }
}

// ----------------------------------------------------------------------------
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
function createDataDisplay(evt) {
  let dataFunc = evt.target.dataset['func']
  let details = uploadDetails.value

  if (dataFunc !== undefined) {
    for (let displayLink of displayLinks) displayLink.classList.remove('active')
    if (activeFunc === dataFunc || dataFunc === 'listEverything') {
      document.querySelector('#dataTabsNav a[data-func="listEverything"]').classList.add('active')
      activeFunc = null
      uploadDetailsList.classList.add('hidden')
      uploadDetails.classList.remove('hidden')
      return
    }
  } else dataFunc = document.querySelector('#dataTabsNav a.active').dataset['func']

  if (dataFunc === 'listEverything') {
    document.querySelector('#dataTabsNav a[data-func="listEverything"]').classList.add('active')
    activeFunc = null
    uploadDetailsList.classList.add('hidden')
    uploadDetails.classList.remove('hidden')
    return
  }

  let fileData = {}

  let rows = details.trim().split('\n')
  if (rows[0] === '') {
    document.querySelector('#dataTabsNav a[data-func="listEverything"]').classList.add('active')
    return
  }

  for (let row of rows) fileData[row.split(' : ', 1)[0].trim()] = JSON.parse(row.match(/(\{.[^}]*})/i)[0])

  uploadDetailsList.value = ''
  for (let fileKey of Object.keys(fileData)) {
    let current = fileData[fileKey]
    let currentKey = null
    let thumbnail = null
    let viewerId = null
    let format = null

    try {
      currentKey = current['sharelink'].match(/key=(.[^&]*)/i)[1]
    } catch (error) {
      uploadDetailsList.value += '/* ' + fileKey + ' */\n'
      uploadDetailsList.value += 'Error reading out file information\n'
      continue
    }

    try {
      thumbnail = current['thumbnail']
    } catch (error) {
      uploadDetailsList.value += '/* ' + fileKey + ' */\n'
      uploadDetailsList.value += 'Error reading out file information\n'
      continue
    }

    try {
      format = fileKey.match(/(\.webm|\.mp4)/gi)[0]
    } catch (error) {
      format = null
    }

    try {
      viewerId = current['hotlink'].match(/\/img\/[\d]*\/[\d]*\/[\d]*\/(.*)/i)[1]
    } catch (error) {
      uploadDetailsList.value += '/* ' + fileKey + ' */\n'
      uploadDetailsList.value += 'Error reading out file information\n'
      continue
    }
    if (document.querySelector('#displayNamesCheckbox').checked) uploadDetailsList.value += '/* ' + fileKey + ' */\n'
    if (dataFunc === 'listShareLinks') {
      uploadDetailsList.value += current['sharelink'] + '\n'
    } else if (dataFunc === 'listHotLinks') {
      uploadDetailsList.value += 'https://www.picflash.org/viewer.php?img=' + viewerId + '\n'
    } else if (dataFunc === 'listDeleteLinks') {
      uploadDetailsList.value += current['delete_url'] + '\n'
    } else if (dataFunc === 'listMarkdownLinks') {
      uploadDetailsList.value += '[![Alternative text](' + thumbnail +' "Image title")] (https://www.picflash.org/viewer.php?img=' + viewerId + ')\n'
    } else if (dataFunc === 'listBBcodesPreviewLinks') {
      uploadDetailsList.value += '[url=' + current['sharelink'] +'][img]' + thumbnail + '[/img][/url]\n'
    } else if (dataFunc === 'listBBcodesHotLinks') {
      uploadDetailsList.value += '[url=' + current['sharelink'] +'][img]https://www.picflash.org/viewer.php?img=' + viewerId + '[/img][/url]\n'
    } else if (dataFunc === 'listHTMLLinks') {
      uploadDetailsList.value += '<a href="' + current['sharelink'] + '"><img alt="" src="' + thumbnail + '" /></a>\n'
    } else if (dataFunc === 'listBBVideoCodeLinks') {
      if (format === null) continue
      uploadDetailsList.value += '[video=picflash;' + fileKey.replace(format, '', 1) + currentKey + format + ']' + current['sharelink'] + '[/video]\n'
    } else if (dataFunc === 'listDeleteLinks') {
      uploadDetailsList.value += current['delete_url'] + '\n'
    } else {
      uploadDetailsList.value = 'Invalid selection, this should not happen!\n'
      continue
    }
  }

  activeFunc = dataFunc
  evt.target.classList.add('active')
  uploadDetails.classList.add('hidden')
  uploadDetailsList.classList.remove('hidden')
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
let uploadStatus = { 'cnt': 0, 'cntTotal': 0, 'uploadInProgress': false, 'uploadQueue': [], 'uploadError': [], 'current': null}
let runData = {}
let originalTitle = document.title

let uploadCurrentFile = document.querySelector('#uploadCurrentFile')
let uploadProgressPercent = document.querySelector('#uploadProgressPercent')
let uploadProgressFiles = document.querySelector('#uploadProgressFiles')
let uploadLog = document.querySelector('#uploadLog')
let uploadDetails = document.querySelector('#uploadDetails')
let uploadDetailsList = document.querySelector('#uploadDetailsList')
let apiKey = document.querySelector('#apikey')
let uploadListLocal = document.querySelector('#uploadListLocal')
let uploadListRemote = document.querySelector('#uploadListRemote')
let uploadRemoteInput = document.querySelector('#uploadRemoteInput')


// ---------------------------------------------------------------------------------------------------
apiKey.addEventListener('keyup', setApiKey)
uploadRemoteInput.addEventListener('keyup', readRemotePictures)

document.querySelector('#uploadLocalInput').addEventListener('change', readLocalPictures)
document.querySelector('#submitLocalUploadButton').addEventListener('click', collectLocalPictures)
document.querySelector('#submitRemoteUploadButton').addEventListener('click', collectRemotePictures)
document.querySelector('#checkRemoteUploadsButton').addEventListener('click', checkRemoteUploads)
document.querySelector('#clearUploadHistoryButton').addEventListener('click', clearUploadData)
document.querySelector('#displayNamesCheckbox').addEventListener('click', createDataDisplay)

// ---------------------------------------------------------------------------------------------------
resetStatus()
readRuntimeData()
document.querySelector('#uploadLocalInput').dispatchEvent(new Event('change'))
uploadRemoteInput.dispatchEvent(new Event('keyup'))

let displayLinks = document.querySelectorAll('#dataTabsNav a')
for (let displayLink of displayLinks) displayLink.addEventListener('click', createDataDisplay)
let activeFunc = null
document.querySelector('#dataTabsNav a[data-func="listEverything"]').classList.add('active')
