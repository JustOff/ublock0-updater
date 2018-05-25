"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr, Constructor: CC} = Components;
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");

const branch = "extensions.ublock0-updater.";
const XMLHttpRequest = CC("@mozilla.org/xmlextras/xmlhttprequest;1","nsIXMLHttpRequest");
const u0id = "uBlock0@raymondhill.net", u0Data = `<?xml version="1.0" encoding="UTF-8"?>
<RDF:RDF xmlns:RDF="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:em="http://www.mozilla.org/2004/em-rdf#">
  <RDF:Description about="urn:mozilla:extension:uBlock0@raymondhill.net">
    <em:updates>
      <RDF:Seq>
        <RDF:li>
          <RDF:Description>
            <em:version>%VERSION%</em:version>
            <em:targetApplication>
              <RDF:Description>
                <em:id>{8de7fcbb-c55c-4fbe-bfc5-fc555c87dbc4}</em:id>
                <em:minVersion>27.0.0</em:minVersion>
                <em:maxVersion>28.*</em:maxVersion>
                <em:updateLink>https://github.com/gorhill/uBlock/releases/download/firefox-legacy-%VERSION%/uBlock0.firefox-legacy.xpi</em:updateLink>
              </RDF:Description>
            </em:targetApplication>
            <em:targetApplication>
              <RDF:Description>
                <em:id>{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}</em:id>
                <em:minVersion>2.40</em:minVersion>
                <em:maxVersion>*</em:maxVersion>
                <em:updateLink>https://github.com/gorhill/uBlock/releases/download/firefox-legacy-%VERSION%/uBlock0.firefox-legacy.xpi</em:updateLink>
              </RDF:Description>
            </em:targetApplication>
            <em:targetApplication>
              <RDF:Description>
                <em:id>{ec8030f7-c20a-464f-9b0e-13a3a9e97384}</em:id>
                <em:minVersion>45.0</em:minVersion>
                <em:maxVersion>56.*</em:maxVersion>
                <em:updateLink>https://github.com/gorhill/uBlock/releases/download/firefox-legacy-%VERSION%/uBlock0.firefox-legacy.xpi</em:updateLink>
              </RDF:Description>
            </em:targetApplication>
            <em:targetApplication>
              <RDF:Description>
                <em:id>{3550f703-e582-4d05-9a08-453d09bdfdc6}</em:id>
                <em:minVersion>45.0</em:minVersion>
                <em:maxVersion>*</em:maxVersion>
                <em:updateLink>https://github.com/gorhill/uBlock/releases/download/firefox-legacy-%VERSION%/uBlock0.firefox-legacy.xpi</em:updateLink>
              </RDF:Description>
            </em:targetApplication>
          </RDF:Description>
        </RDF:li>
      </RDF:Seq>
    </em:updates>
  </RDF:Description>
</RDF:RDF>`;

var u0Beta = false, u0Ver = "";

var httpObserver = {
  observe: function(subject, topic, data) {
    if (topic == 'http-on-examine-response' || topic == 'http-on-examine-cached-response') {
      subject.QueryInterface(Ci.nsIHttpChannel);
      if ((subject.URI.host == "addons.palemoon.org" ||
           subject.URI.host == "versioncheck.addons.mozilla.org" ||
           subject.URI.host == "versioncheck-bg.addons.mozilla.org") 
          && subject.URI.path.indexOf("&id=" + u0id +"&") != -1) {
        checkUpdate();
        subject.QueryInterface(Ci.nsITraceableChannel);
        var newListener = new TracingListener();
        newListener.originalListener = subject.setNewListener(newListener);
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
    if (u0Ver != "") {
      data = u0Data.replace(/%VERSION%/g, u0Ver);
    } else {
      data = '<RDF:RDF xmlns:RDF="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:em="http://www.mozilla.org/2004/em-rdf#"></RDF:RDF>';
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

var prefObserver = {
  observe: function(subject, topic, data) {
    if (topic == "nsPref:changed" && data == "u0Beta") {
      u0Beta = Services.prefs.getBranch(branch).getBoolPref("u0Beta");
      u0Ver = "";
      AddonManager.getAllInstalls(function(aList) {
        for (var addon of aList) {
          if (addon.existingAddon && addon.existingAddon.id == u0id) {
            addon.cancel();
          }
        }
      })
    }
  },
  register: function() {
    this.prefBranch = Services.prefs.getBranch(branch);
    this.prefBranch.addObserver("", this, false);
  },
  unregister: function() {
    this.prefBranch.removeObserver("", this);
  }
}

function doUpdate(newVer) {
  if (newVer != u0Ver) {
    u0Ver = newVer;
    AddonManager.getAddonByID(u0id, function(addon) {
      addon.findUpdates({
        onUpdateAvailable: function(aAddon, aInstall) {
          if (aAddon.permissions & AddonManager.PERM_CAN_UPGRADE && AddonManager.shouldAutoUpdate(aAddon)) {
            aInstall.install();
          }
        }
      }, AddonManager.UPDATE_WHEN_USER_REQUESTED);
    });
  }
}

function checkUpdate() {
  var ver, vermask, request = new XMLHttpRequest();
  if (u0Beta) {
    vermask = /tree\/firefox\-legacy\-(\d+\.\d+\.\w+)$/;
  } else {
    vermask = /tree\/firefox\-legacy\-(\d+\.\d+\.\d+)$/;
  }
  request.open("GET", "https://github.com/gorhill/uBlock");
  request.responseType = "document";
  request.onload = function() {
    try {
      var tags = this.responseXML.querySelector("div[data-tab-filter='tags']").querySelectorAll("a[href*='firefox-legacy']");
      for (var tag of tags) {
        if ((ver = vermask.exec(tag)) !== null) {
          doUpdate(ver[1]);
          break;
        }
      }
    } catch (e) {}
  }
  request.send();
}

function startup(data, reason) {
  try {
    u0Beta = Services.prefs.getBranch(branch).getBoolPref("u0Beta");
  } catch (e) {}
  prefObserver.register();
  httpObserver.register();
}

function shutdown(data, reason) {
  if (reason == APP_SHUTDOWN) return;
  httpObserver.unregister();
  prefObserver.unregister();
}

function install() {};
function uninstall() {};
