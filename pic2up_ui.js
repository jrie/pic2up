'use strict'

let useChrome = typeof (browser) === 'undefined'
let useTab = false

if (useTab) {
    if (useChrome) chrome.tabs.create({'url': 'pic2up.html', 'title': ''});
    else browser.tabs.create({'url': 'pic2up.html', 'title': ''});
} else {
    if (useChrome) chrome.windows.create({'type': 'popup', 'url': 'pic2up.html', 'height': 600, 'width': 800 });
    else browser.windows.create({'type': 'popup', 'url': 'pic2up.html', 'titlePreface': '', 'height': 600, 'width': 800 });
}
