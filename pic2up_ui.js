'use strict'

let useChrome = typeof (browser) === 'undefined'

function handleMessage(request, sender, sendResponse) {
  if (useChrome) {
    if (request['getData'] !== undefined) chrome.storage.local.get(function (data) {
      sendResponse(data)
      return true
    })
    else chrome.storage.local.set(request['saveData'])
    return true
  }

  if (request['getData'] !== undefined) sendResponse(browser.storage.local.get())
  else browser.storage.local.set(request['saveData'])
}

if (useChrome) {
  chrome.windows.create({'type': 'popup', 'url': 'pic2up.html', 'height': 600, 'width': 800 });
  chrome.runtime.onMessage.addListener(handleMessage)
} else {
  browser.windows.create({'type': 'popup', 'url': 'pic2up.html', 'titlePreface': '', 'height': 600, 'width': 800 });
  browser.runtime.onMessage.addListener(handleMessage)
}



