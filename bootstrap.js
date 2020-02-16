"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr, Constructor: CC} = Components;
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");

const branch = "extensions.ublock0-updater.";
const XMLHttpRequest = CC("@mozilla.org/xmlextras/xmlhttprequest;1","nsIXMLHttpRequest");
const u0id = "uBlock0@raymondhill.net", selfId = "ublock0-updater@Off.JustOff";
const u0updateURL = 'https://raw.githubusercontent.com/gorhill/uBlock-for-firefox-legacy/master/dist/update/update.xml';
const versionMask = /<em:version>(\d+\.\d+\.\d+(?:\.\d+)?)<\/em:version>/;
const emptyData = '<?xml version="1.0" encoding="UTF-8"?>' +
      '<RDF:RDF xmlns:RDF="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:em="http://www.mozilla.org/2004/em-rdf#"></RDF:RDF>';

var u0Data = "", u0Ver = "";

var httpObserver = {
  observe: function(subject, topic, data) {
    if (topic == 'http-on-examine-response' || topic == 'http-on-examine-cached-response') {
      subject.QueryInterface(Ci.nsIHttpChannel);
      if ((subject.URI.host == "addons.palemoon.org" ||
           subject.URI.host == "addons.basilisk-browser.org" ||
           subject.URI.host == "interlink-addons.binaryoutcast.com" ||
           subject.URI.host == "versioncheck.addons.mozilla.org" ||
           subject.URI.host == "versioncheck-bg.addons.mozilla.org") 
          && subject.URI.path.indexOf("&id=" + u0id +"&") != -1) {
        checkUpdate();
        subject.QueryInterface(Ci.nsITraceableChannel);
        var newListener = new TracingListener();
        newListener.originalListener = subject.setNewListener(newListener);
      } else if (subject.URI.spec == u0updateURL) {
        selfDestruct();
      }
    }
  },
  QueryInterface: function(aIID) {
    if (aIID.equals(Ci.nsIObserver) || aIID.equals(Ci.nsISupports)) {
      return this;
    } else {
      throw Cr.NS_NOINTERFACE;
    }
  },
  register: function() {
    Services.obs.addObserver(this, "http-on-examine-cached-response", false);
    Services.obs.addObserver(this, "http-on-examine-response", false);
  },
  unregister: function() {
    Services.obs.removeObserver(this, "http-on-examine-cached-response");
    Services.obs.removeObserver(this, "http-on-examine-response");
  }
}

function CCIN(cName, ifaceName) {
  return Cc[cName].createInstance(Ci[ifaceName]);
}

function TracingListener() {
}

TracingListener.prototype = {
  onDataAvailable: function(request, context, inputStream, offset, count) {
    // by contract mListener must read all of "count" bytes, see #266532
    var binaryInputStream = CCIN("@mozilla.org/binaryinputstream;1","nsIBinaryInputStream");
    binaryInputStream.setInputStream(inputStream);
    var data = binaryInputStream.readBytes(count);
  },
  onStartRequest: function(request, context) {
    try {
      this.originalListener.onStartRequest(request, context);
    } catch (err) {
      request.cancel(err.result);
    }
  },
  onStopRequest: function(request, context, statusCode) {
    var data;
    if (u0Ver != "" && u0Data != "") {
      data = u0Data;
    } else {
      data = emptyData;
    }
    var storageStream = CCIN("@mozilla.org/storagestream;1", "nsIStorageStream");
    storageStream.init(8192, data.length, null);
    var os = storageStream.getOutputStream(0);
    if (data.length > 0) {
      os.write(data, data.length);
    }
    os.close();
    try {
      this.originalListener.onDataAvailable(request, context, storageStream.newInputStream(0), 0, data.length);
    } catch (e) {}
    try {
      this.originalListener.onStopRequest(request, context, statusCode);
    } catch (e) {}
  },
  QueryInterface: function(aIID) {
    if (aIID.equals(Ci.nsIStreamListener) || aIID.equals(Ci.nsISupports)) {
      return this;
    } else {
      throw Cr.NS_NOINTERFACE;
    }
  }
}

function doUpdate(newVer) {
  if (newVer != u0Ver) {
    u0Ver = newVer;
    var updateInstallListener = {
      onInstallEnded: function(aInstall, aAddon) {
        selfDestruct();
      }
    }
    AddonManager.getAddonByID(u0id, function(addon) {
      addon.findUpdates({
        onUpdateAvailable: function(aAddon, aInstall) {
          if (aAddon.permissions & AddonManager.PERM_CAN_UPGRADE && AddonManager.shouldAutoUpdate(aAddon)) {
            aInstall.addListener(updateInstallListener);
            aInstall.install();
          }
        }
      }, AddonManager.UPDATE_WHEN_USER_REQUESTED);
    });
  }
}

function checkUpdate() {
  var ver, request = new XMLHttpRequest();
  request.open("GET", u0updateURL + "?_=self");
  request.onload = function() {
    if ((ver = versionMask.exec(request.responseText)) !== null) {
      u0Data = request.responseText;
      doUpdate(ver[1]);
    }
  }
  request.send();
}

function selfDestruct() {
  AddonManager.getAddonByID(u0id, function(addon) {
    if (addon && Services.vc.compare(addon.version, "1.16.4.17") >= 0) {
      var goodbay = false, goodbayUrl = "https://github.com/JustOff/ublock0-updater/issues/112?_=goodbye-",
          appInfo = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo);
      if (appInfo.ID == "{3550f703-e582-4d05-9a08-453d09bdfdc6}") {
        var mrw = Services.wm.getMostRecentWindow("mail:3pane");
        if (mrw && typeof mrw.openLinkExternally === "function") {
          mrw.openLinkExternally(goodbayUrl + "mail");
          goodbay = true;
        }
      } else {
        var mrw = Services.wm.getMostRecentWindow("navigator:browser");
        if (mrw && typeof mrw.getBrowser === "function") {
          mrw.getBrowser().loadOneTab(goodbayUrl + "browser", {inBackground: true});
          goodbay = true;
        }
      }
      if (goodbay) {
        AddonManager.getAddonByID(selfId, function(addon) {
          addon.uninstall();
        });
      }
    }
  });
}

function startup(data, reason) {
  try {
    Services.prefs.getBranch(branch).clearUserPref("u0Beta");
  } catch (e) {}
  httpObserver.register();
  selfDestruct();
}

function shutdown(data, reason) {
  if (reason == APP_SHUTDOWN) return;
  httpObserver.unregister();
}

function install() {};
function uninstall() {};
