var secField;
var minField;
var toggleButton;
var dashboardLink;

function updateSecond(tabId, s) {
  console.log("updateSecond");
  updateTabHistory(tabId, "sec", parseInt(s));
  console.log('Second is set to ' + parseInt(s));
}

function updateMinute(tabId, m) {
  console.log("updateMinute");
  updateTabHistory(tabId, "min", parseInt(m));
  console.log('Minute is set to ' + parseInt(m));
}

async function storageOnChange(changes, namespace) {
  console.log("storageOnChange", changes, namespace);
  let tab = await getTabInfo();
  if (changes.hasOwnProperty(tab.id.toString())) {
    let storageChange = changes[tab.id.toString()];
    if (!storageChange.hasOwnProperty("newValue")) {
      updateToggle(false);
      return;
    }
    updateToggle(!storageChange.newValue.enabled);
  }
};

async function inputHandler(e) {
  console.log("inputHandler");
  console.log(e.target);
  let tab;
  let tabHistory;
  if (e.target.id == "min" || e.target.id == "sec") {
    tab = await getTabInfo();
    tabHistory = await getTabHistory(tab.id);
    if (tabHistory === null) {
      await createTabHistory(tab);
    }
  }
  if (e.target.id == "min") {
    updateMinute(tab.id, e.target.value);
  }
  if (e.target.id == "sec") {
    updateSecond(tab.id, e.target.value);
  }
}

async function toggleHandler(e) {
  console.log("toggleHandler");
  let interval = parseInt(minField.value) * 60 + parseInt(secField.value)
  if (interval <= 0) {
    chrome.notifications.create(
        chrome.runtime.id + "|" +
            "warning",
        {
          title : "Invalid Time Interval",
          message : "The time interval must be greater than 0",
          type : "basic",
          iconUrl : "icon.png",
          isClickable : true,
          requireInteraction : false
        });
  }

  let tab = await getTabInfo();
  console.log(tab);
  let tabHistory = await getTabHistory(tab.id);
  console.log(tabHistory);
  if (tabHistory === null) {
    return;
  }
  if (tabHistory.enabled) {
    chrome.runtime.sendMessage({message : "stop:" + tab.id});
  } else {
    chrome.runtime.sendMessage({message : "refresh:" + tab.id});
  }
}

async function setup(tabId) {
  console.log("setup");
  secField = document.getElementById("sec");
  minField = document.getElementById("min");

  toggleButton.addEventListener('click', toggleHandler);
  minField.addEventListener('input', inputHandler);
  secField.addEventListener('input', inputHandler);
  chrome.storage.onChanged.addListener(storageOnChange);

  let tabHistory = await getTabHistory(tabId);
  console.log("got tabHistory");
  console.log(tabHistory);
  if (isObjectEmpty(tabHistory)) {
    console.log("no tab history found");
    minField.value = 0;
    secField.value = 0;
    updateToggle(true);
  } else {
    console.log("tab history found");
    if (tabHistory.enabled) {
      updateToggle(false);
    } else {
      updateToggle(true);
    }
    minField.value = tabHistory.min;
    secField.value = tabHistory.sec;
  }
}

function updateToggle(enable) {
  if (enable) {
    toggleButton.style.backgroundColor = "green";
    toggleButton.innerText = "start refreshing this tab";
    secField.disabled = false;
    minField.disabled = false;
  } else {
    toggleButton.style.backgroundColor = "red";
    toggleButton.innerText = "stop refreshing this tab";
    secField.disabled = true;
    minField.disabled = true;
  }
}

function blockToggle() {
  toggleButton.style.backgroundColor = "yellow";
  toggleButton.innerText = "this tab is not supported";
}

function openDashboard(e) {
  console.log("openDashboard");
  chrome.tabs.create({url : "dashboard.html"});
}

document.addEventListener('DOMContentLoaded', async function(e) {
  console.log("DOMContentLoaded");
  acl = await getManifestACL();
  toggleButton = document.getElementById("toggle");
  dashboardLink = document.getElementById("dashboard");
  dashboard.addEventListener('click', openDashboard);

  let tab = await getTabInfo();
  if (tab === null) {
    console.log("tab doesn't exist");
    blockToggle();
    return;
  }
  if (tab.url.includes("chrome-extension://") ||
      tab.url.includes("chrome://")) {
    console.log("ignoring internal chrome urls");
    blockToggle();
    return;
  }

  if (!isURLApproved(tab.url, acl)) {
    console.log("ignoring unapproved urls");
    blockToggle();
    return;
  }

  setup(tab.id);
});
