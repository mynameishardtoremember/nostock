var acl;

async function stageRefresh(tabId) {
  // console.log("stageRefresh");
  let targetTab = await getTabById(tabId);
  // console.log("targetTab", targetTab);
  if (targetTab === null) {
    // console.log("will not stage: tab itself doesn't exist");
    await updateTabHistory(tabId, "exist", false);
    return;
  }

  let tabHistory = await getTabHistory(tabId);
  // console.log(tabHistory);
  if (tabHistory === null) {
    // console.log("will not stage: tab history doesn't exist");
    return;
  }

  let interval = parseInt(tabHistory.min) + (parseInt(tabHistory.sec) / 60)
  // console.log("interval: " + interval);
  if (interval <= 0) {
    // console.log("will not stage: invalid interval");
    return;
  }
  await updateTabHistory(tabId, "enabled", true);
  await createURLEntry(targetTab.url);
}

async function startRefresh(tabId) {
  // console.log("startRefresh", tabId);
  let tabHistory = await getTabHistory(tabId);
  if (isObjectEmpty(tabHistory)) {
    return;
  }
  if (!tabHistory.enabled) {
    // console.log("tab is not enabled");
    return;
  }
  if (!tabHistory.exist) {
    return;
  }
  if (tabHistory.alarmName != "") {
    let alarmInfo = await getAlarmByName(tabHistory.alarmName);
    if (alarmInfo != null) {
      return;
    }
  }

  let interval = parseInt(tabHistory.min) + (parseInt(tabHistory.sec) / 60)
  let alarmTab = await getAlarmByTab(tabHistory.obj, interval);
  if (alarmTab === null) {
    await createAlarmForTab(tabHistory, interval);
    await detect(tabId);
  }
}

async function detect(tabId) {
  console.log("detect", tabId);
  let tabIdInt = parseInt(tabId);
  let extIdCode = `var AUTOREFRESH_EXT_ID="` + chrome.runtime.id + `";`;
  chrome.tabs.executeScript(tabIdInt, {code : extIdCode}, function(result) {
    chrome.tabs.executeScript(tabIdInt, {file : "detect.js"});
    console.log("detect deployed");
  });
}

async function stopRefresh(tabId) {
  // console.log("stopRefresh", tabId);
  let tabHistory = await getTabHistory(tabId);
  // console.log("tabHistory", tabHistory);
  if (isObjectEmpty(tabHistory)) {
    return;
  }
  if (tabHistory.enabled) {
    // console.log("setting enabled to false");
    updateTabHistory(tabId, "enabled", false);
  }
  if (tabHistory.alarmName != "") {
    // console.log("clearing alarmName from tabHistory");
    stopAlarmByTab(tabHistory.obj);
    updateTabHistory(tabId, "alarmName", "");
    document.getElementById("alertSound").pause();
  }
}

function disableRefresh(tabId) {
  // console.log("disableRefresh");
  updateTabHistory(tabId, "enabled", false);
  // console.log("Setting enabled as false");
}

function storageOnChange(changes, namespace) {
  // console.log("storageOnChange", changes, namespace);
  for (let tabId in changes) {
    let storageChange = changes[tabId];
    if (storageChange.hasOwnProperty("newValue") &&
        storageChange.hasOwnProperty("oldValue") &&
        storageChange.newValue.enabled != storageChange.oldValue.enabled) {
      switch (storageChange.newValue.enabled) {
      case true:
        startRefresh(tabId);
        break;
      case false:
        stopRefresh(tabId);
        break;
      }
    }
  }
};

function alarmHandler(alarm) {
  console.log("Got the refresh alarm!", alarm);
  alarmMetadata = alarm.name.split("|");
  if (alarmMetadata.length != 2) {
    return;
  }
  targetTabId = parseInt(alarmMetadata[0]);
  try {
    chrome.tabs.get(targetTabId, function(tab) {
      // console.log(tab);
      if (tab === undefined) {
        disableRefresh(targetTabId);
        return;
      }
      chrome.tabs.reload(targetTabId,
                         function() { console.log("refreshing " + tab.id); });
    });
  } catch (e) {
    disableRefresh(targetTabId);
  }
}

async function tabHandler(targetTabId, changeInfo, tab) {
  if (tab.url.startsWith("chrome-extension://") ||
      tab.url.startsWith("chrome://") ||
      tab.url.startsWith("chrome-untrusted://")) {
    return;
  }
  if (changeInfo.status != 'complete') {
    return;
  }
  if (isURLApproved(tab.url, acl)) {
    // console.log(targetTabId);
    // console.log(changeInfo);
    // console.log(tab);
    let tabHistory = await getTabHistory(targetTabId);
    // console.log("tabHistory", tabHistory);
    if (tabHistory === null) {
      return;
    }
    if (tabHistory.url =
            tab.url && tabHistory.enabled && tabHistory.alarmName != "") {
      // console.log(targetTabId + " done loading. startRefresh now.");
      detect(tab.id);
    }
  }
}

async function messageHandler(request, sender, sendResponse) {
  console.log("request", request);
  console.log("sender", sender);
  if (request.hasOwnProperty("message")) {
    // console.log('message received: ' + request.message);
    if (request.message.startsWith("refresh:")) {
      let msg = request.message.split(":");
      let targetTabId = parseInt(msg[1]);
      stageRefresh(targetTabId);
    }
    if (request.message.startsWith("stop:")) {
      let msg = request.message.split(":");
      let targetTabId = parseInt(msg[1]);
      disableRefresh(targetTabId);
    }
    sendResponse({message : "ack"});
  }
  if (request.hasOwnProperty("instock")) {
    logStock(sender.tab.url, request.instock, new Date().getTime());
    if (!request.instock) {
      sendResponse({message : "ack"});
    } else {
      let targetTabId = sender.tab.id;
      let targetURL = sender.tab.url;
      chrome.notifications.create(chrome.runtime.id + "_" + sender.tab.id, {
        title : targetURL + ": In stock!",
        message : "Click here to see the tab",
        type : "basic",
        iconUrl : "icon.png",
        isClickable : true,
        requireInteraction : true
      });
      let alertSound = document.getElementById("alertSound");
      alertSound.currentTime = 0;
      alertSound.play();
      sendResponse({message : "ack"});
    }
  }
}

async function removedTabHandler(tabId, removeInfo) {
  // console.log("onRemoved");
  let tabHistory = await updateTabHistory(tabId, "exist", false);
  // console.log("tabHistory", tabHistory);
  if (tabHistory === null) {
    return;
  }
  stopAlarmByName(tabHistory.alarmName);
  updateTabHistory(tabId, "alarmName", "");
  clearNotificationByTab(tabHistory.obj);
}

function notifyClickHandler(notificationId, buttonIndex) {
  // console.log("notifyClickHandler", notificationId, buttonIndex);
  if (notificationId.startsWith(chrome.runtime.id + "_")) {
    notifyMetadata = notificationId.split("_")
    if (notifyMetadata.length != 2) {
      return;
    }
    chrome.tabs.update(parseInt(notifyMetadata[1]),
                       {active : true, highlighted : true, selected : true},
                       function(tab) {
                         // console.log("tab", tab)
                         chrome.windows.update(
                             tab.windowId, {focused : true}, function(window) {
                               document.getElementById("alertSound").pause();
                               clearNotification(notificationId);
                             });
                       });
  }
}

document.addEventListener('DOMContentLoaded', async function(e) {
  acl = await getManifestACL();
  // console.log("acl", acl);
  chrome.runtime.onMessage.addListener(messageHandler);
  chrome.storage.onChanged.addListener(storageOnChange);
  chrome.tabs.onRemoved.addListener(removedTabHandler);
  chrome.tabs.onUpdated.addListener(tabHandler);
  chrome.alarms.onAlarm.addListener(alarmHandler);
  chrome.notifications.onClicked.addListener(notifyClickHandler);
});
