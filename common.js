// {tab, enabled, min, sec, exist, alarmName }
async function createTabHistory(tab) {
  return new Promise((resolve, reject) => {
    // //console.log("createTabInterval");
    let tabObj = {
      obj : tab,
      enabled : false,
      min : 0,
      sec : 0,
      exist : true,
      alarmName : ""
    };
    // //console.log(tabObj);
    let tabId = (tab.id).toString();
    // //console.log(tabId);
    let data = {};
    data[tabId] = tabObj;
    chrome.storage.local.set(data, function() {
      // //console.log("successfully created tab history for " + tab.id);
      resolve(tabObj);
    });
  });
}

async function updateTabHistory(tabId, key, value) {
  // //console.log("updateTabHistory", tabId, key, value);
  let tabHistory = await getTabHistory(tabId);
  // //console.log("tabHistory: ", tabHistory);
  if (tabHistory === null) {
    // //console.log("cannot update if tabHistory is null");
    return null;
  }
  tabHistory[key] = value;
  // console.log(tabHistory);
  let data = {};
  data[tabId.toString()] = tabHistory;
  await chrome.storage.local.set(data, function() {
    // console.log("updated tab history for " + tabId, key, value);
  });
  // console.log("returning tabHistory - updateTabHistory");
  return tabHistory;
}

async function getTabHistory(tabId) {
  // console.log("getTabHistory", tabId);
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(tabId.toString(), function(result) {
      // console.log("result", result);
      if (result.hasOwnProperty(tabId)) {
        // console.log(result[tabId]);
        resolve(result[tabId]);
      } else {
        resolve(null);
      }
    });
  });
}

async function getTabInfo() {
  // console.log("getTabInfo");
  return new Promise((resolve, reject) => {
    chrome.tabs.getSelected(null, function(tabInfo) {
      // console.log(tabInfo);
      if (tabInfo === undefined) {
        resolve(null);
      } else {
        resolve(tabInfo);
      }
    });
  });
}

async function getTabById(tabId) {
  // console.log("getTabById");
  return new Promise((resolve, reject) => {
    chrome.tabs.get(tabId, function(targetTab) {
      // console.log(targetTab);
      if (targetTab === undefined) {
        resolve(null);
        return;
      }
      resolve(targetTab);
    });
  });
}

async function getAlarmByName(name) {
  // console.log("getAlarmByName");
  return new Promise((resolve, reject) => {
    chrome.alarms.get(name, function(a) {
      // console.log(a);
      if (a === undefined) {
        resolve(null);
        return;
      }
      resolve(a);
    });
  });
}

async function getAlarmByTab(targetTab) {
  // console.log("getAlarmByTab");
  return new Promise((resolve, reject) => {
    let alertTab = getAlarmByName(targetTab.id + "|" + targetTab.url);
    resolve(alertTab);
  });
}

async function stopAlarmByName(name) {
  // console.log("stopAlarmByName", name);
  return new Promise((resolve, reject) => {
    chrome.alarms.clear(name, function(targetAlarm) {
      // console.log(name, "has been cleared");
      resolve(true);
    });
  });
}

async function stopAlarmByTab(targetTab) {
  // console.log("stopAlarmByTab", targetTab);
  return new Promise((resolve, reject) => {
    stopAlarmByName(targetTab.id + "|" + targetTab.url);
    resolve(true);
  });
}

async function createAlarmForTab(targetTab, interval) {
  // console.log("createAlertForTab", targetTab, interval);
  return new Promise((resolve, reject) => {
    let alarmName = targetTab.obj.id + "|" + targetTab.obj.url;
    // console.log("alarmName", alarmName);
    chrome.alarms.create(
        alarmName, {delayInMinutes : interval, periodInMinutes : interval});
    updateTabHistory(targetTab.obj.id, "alarmName", alarmName);
    resolve();
  });
}

function isObjectEmpty(obj) {
  if (obj === null || obj === undefined ||
      (Object.keys(obj).length === 0 && obj.constructor === Object)) {
    return true;
  } else {
    return false;
  }
}

async function getManifestACL() {
  // console.log("getManifestACL");
  return new Promise((resolve, reject) => {
    let urls = [];
    let prefix = "*://*.";
    for (let p of chrome.runtime.getManifest().permissions) {
      if (p.startsWith(prefix)) {
        let url = p.substring(prefix.length, (p.length - 2));
        if (!(url in urls)) {
          urls.push(url);
        }
      }
    }
    resolve(urls);
  });
}

function isURLApproved(tabURL, urlACL) {
  // console.log("isURLApproved");
  let targetURL = new URL(tabURL);
  // console.log("targetURL", targetURL);
  for (let url of urlACL) {
    if (targetURL.host.includes(url)) {
      // console.log(targetURL.host, url);
      return true;
    }
  }
  return false;
}

function clearNotification(notificationId) {
  // console.log("clearNotification");
  chrome.notifications.clear(
      notificationId,
      function(wasCleared) { console.log(notificationId, wasCleared); });
}

function clearNotificationByTab(tab) {
  // console.log("clearNotificationByTab");
  notificationId = chrome.runtime.id + "_" + tab.id;
  clearNotification(notificationId);
}

// Url Entry
// [
//  {id:1, url},
//  {id:2, url},
//  ...
// ]
// Each index represents the URL ID.
// index of 0 = id of 1.
async function createURLEntry(url) {
  console.log("createURLEntry", url);
  // first if the url exists in urlEntry.
  let urlEntry = await getURLEntry();
  console.log("urlEntry", urlEntry);
  // urlEntry is empty
  if (urlEntry === null) {
    console.log("urlEntry is empty");
    let urlEntry = [ {id : 1, url : url} ];
    let urlEntryJson = JSON.stringify(urlEntry);
    chrome.storage.local.set({urlEntry : urlEntryJson});
    console.log("final urlEntry", urlEntry);
    return urlEntry;
  }
  // urlEntry is not empty
  console.log("urlEntry exists");
  // check if the url exists in urlEntry
  let targetURLEntry = getURLEntryByURL(urlEntry, url);
  console.log("targetURLEntry", targetURLEntry);
  if (targetURLEntry == null) {
    let urlEntryId = targetURLEntry.length + 1;
    urlEntry.push({id : urlEntryId, url : url});
    let urlEntryJSON = JSON.stringify(urlEntry);
    chrome.storage.local.set({urlEntry : urlEntryJSON});
    console.log("final urlEntry", urlEntry);
  }
}

async function getURLEntry() {
  console.log("getURLEntry");
  return new Promise((resolve, reject) => {
    chrome.storage.local.get("urlEntry", function(urlEntry) {
      if (isObjectEmpty(urlEntry)) {
        resolve(null);
      } else {
        let parsedURLEntry = JSON.parse(urlEntry.urlEntry);
        resolve(parsedURLEntry);
      }
    });
  });
}

async function getURLEntryByURL(urlEntry, url) {
  console.log("getURLEntryByURL", urlEntry, url);
  for (entry of urlEntry) {
    if (entry.url == url) {
      return entry;
    }
  }
  return null;
}

// logEntry is an array of objects consisting of URL and array of logs.
// Each index in logEntry represents urlId. Index(0) = urlId(1).
// {logEntry: []}
// [
//  0: {urlId: 1, logs: [{id, epoch, timestamp, instock}, ..., n]},
//  1: {urlId: 2, logs: [{id, epoch, timestamp, instock}, ..., n]},
//  {...},
// ]
async function createLogEntry(urlEntryId, log) {
  console.log("createLogEntry", urlEntryId, log);
  logEntries = await getLogEntries();
  console.log("logEntries", logEntries);

  if (!log.hasOwnProperty("id")) {
    // get next log entry id
  }
  // logEntry = await getLogEntryById(urlEntryId);
  // //console.log("logEntry", logEntry);
  // logEntry.logs.push(log);
  // logEntries = await getLogEntries();
  // let index = urlEntryId - 1;
  // //console.log("index", index);
  // //console.log("logEntries", logEntries);
  // logEntries.logEntry[index] = logEntry;
  // chrome.storage.local.set(
  //   logEntries, function() { //console.log(logEntry, "has been added") });
}

async function getLogEntries() {
  console.log("getLogEntries");
  chrome.storage.local.get("logEntry", function(logEntries) {
    if (isObjectEmpty(logEntries)) {
      console.log("logEntry is empty");
      let initLogEntry = {"logEntry" : []};
      chrome.storage.local.set(initLogEntry, function(logEntries) {
        console.log("initLogEntry created", initLogEntry);
        return initLogEntry;
      });
    }
    console.log("got logEntries", logEntries);
    return logEntries;
  });
}

// async function getLogEntryById(urlEntryId) {
//  console.log("getLogEntryById");
//  logEntries = await getLogEntries();
//  console.log("logEntries", logEntries)
//  if (isObjectEmpty(logEntries)) {
//    return null;
//  }
//  for (entry of Object.keys(logEntries)) {
//    if (entry.urlId == urlEntryId) {
//      return entry;
//    }
//  }
//  return null;
//}

async function logStock(url, inStock, epoch) {
  let urlEntryId = await createURLEntry(url);
  console.log("urlEntryId", urlEntryId);
  let log = {
    // nextLogId is unknown
    url : url,
    inStock : inStock,
    epoch : epoch,
    timestamp : new Date(epoch).toLocaleString(),
  };
  console.log("log", log);
  createLogEntry(urlEntryId, log);
}
