"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr, Constructor: CC} = Components;
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");

const branch = "extensions.ublock0-updater.";
const XMLHttpRequest = CC("@mozilla.org/xmlextras/xmlhttprequest;1","nsIXMLHttpRequest");
const u0id = "uBlock0@raymondhill.net", u0dir = "uBlock", u0file = "uBlock0.firefox.xpi",
      uMid = "uMatrix@raymondhill.net", uMdir = "uMatrix", uMfile = "uMatrix.firefox.xpi",
      uData = `<RDF:Description about="urn:mozilla:extension:%APP%">
  <em:updates>
    <RDF:Seq>
      <RDF:li>
        <RDF:Description>
          <em:version>%VERSION%</em:version>
          <em:targetApplication>
            <RDF:Description>
              <em:id>{8de7fcbb-c55c-4fbe-bfc5-fc555c87dbc4}</em:id>
              <em:minVersion>27.0.0</em:minVersion>
              <em:maxVersion>27.*</em:maxVersion>
              <em:updateLink>https://github.com/gorhill/%DIR%/releases/download/%VERSION%/%FILE%</em:updateLink>
            </RDF:Description>
          </em:targetApplication>
          <em:targetApplication>
            <RDF:Description>
              <em:id>{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}</em:id>
              <em:minVersion>2.40</em:minVersion>
              <em:maxVersion>*</em:maxVersion>
              <em:updateLink>https://github.com/gorhill/%DIR%/releases/download/%VERSION%/%FILE%</em:updateLink>
            </RDF:Description>
          </em:targetApplication>
          <em:targetApplication>
            <RDF:Description>
              <em:id>{ec8030f7-c20a-464f-9b0e-13a3a9e97384}</em:id>
              <em:minVersion>45.0</em:minVersion>
              <em:maxVersion>56.*</em:maxVersion>
              <em:updateLink>https://github.com/gorhill/%DIR%/releases/download/%VERSION%/%FILE%</em:updateLink>
            </RDF:Description>
          </em:targetApplication>
          <em:targetApplication>
            <RDF:Description>
              <em:id>{3550f703-e582-4d05-9a08-453d09bdfdc6}</em:id>
              <em:minVersion>45.0</em:minVersion>
              <em:maxVersion>*</em:maxVersion>
              <em:updateLink>https://github.com/gorhill/%DIR%/releases/download/%VERSION%/%FILE%</em:updateLink>
            </RDF:Description>
          </em:targetApplication>
        </RDF:Description>
      </RDF:li>
    </RDF:Seq>
  </em:updates>
</RDF:Description>`;

var u0upd, uMupd, u0ver = "", uMver = "";

var httpObserver = {
	observe: function(subject, topic, data) {
		if (topic == 'http-on-examine-response' || topic == 'http-on-examine-cached-response') {
			subject.QueryInterface(Ci.nsIHttpChannel);
			if (subject.URI.host == "versioncheck.addons.mozilla.org") {
				if (u0upd && subject.URI.path.indexOf("&id=" + u0id +"&") != -1) {
					checkUpdate(u0id, u0dir);
					subject.QueryInterface(Ci.nsITraceableChannel);
					var newListener = new TracingListener();
					newListener.app = u0id;
					newListener.originalListener = subject.setNewListener(newListener);
				} else if (uMupd && subject.URI.path.indexOf("&id=" + uMid +"&") != -1) {
					checkUpdate(uMid, uMdir);
					subject.QueryInterface(Ci.nsITraceableChannel);
					var newListener = new TracingListener();
					newListener.app = uMid;
					newListener.originalListener = subject.setNewListener(newListener);
				}
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
	this.receivedData = [];
}

TracingListener.prototype = {
	onDataAvailable: function(request, context, inputStream, offset, count) {
		var binaryInputStream = CCIN("@mozilla.org/binaryinputstream;1","nsIBinaryInputStream");
		binaryInputStream.setInputStream(inputStream);
		var data = binaryInputStream.readBytes(count);
		this.receivedData.push(data);
	},
	onStartRequest: function(request, context) {
		try {
			this.originalListener.onStartRequest(request, context);
		} catch (err) {
			request.cancel(err.result);
		}
	},
	onStopRequest: function(request, context, statusCode) {
		var upd = "", data = this.receivedData.join("");
		if (this.app == u0id) {
			if (u0ver != "") {
				upd = uData.replace(/%VERSION%/g, u0ver).replace("%APP%", u0id).replace(/%DIR%/g, u0dir).replace(/%FILE%/g, u0file);
			}
		} else {
			if (uMver != "") {
				upd = uData.replace(/%VERSION%/g, uMver).replace("%APP%", uMid).replace(/%DIR%/g, uMdir).replace(/%FILE%/g, uMfile);
			}
		}
		data = data.replace(/<RDF:Description[\s\S]*Description>/, upd);
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
		if (topic != "nsPref:changed") return;
		switch (data) {
			case "uBlock0":
				u0upd = Services.prefs.getBranch(branch).getIntPref("uBlock0");
				u0ver = "";
				AddonManager.getAllInstalls(function(aList) {
					for (var addon of aList) {
						if (addon.existingAddon && addon.existingAddon.id == u0id) {
							addon.cancel();
						}
					}
				});
				break;
			case "uMatrix":
				uMupd = Services.prefs.getBranch(branch).getIntPref("uMatrix");
				uMver = "";
				AddonManager.getAllInstalls(function(aList) {
					for (var addon of aList) {
						if (addon.existingAddon && addon.existingAddon.id == uMid) {
							addon.cancel();
						}
					}
				});
				break;
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

function doUpdate(app, newVer) {
	var isUpd = false;
	if (app == u0id && newVer != u0ver) {
		u0ver = newVer;
		isUpd = true;
	} else if (app == uMid && newVer != uMver) {
		uMver = newVer;
		isUpd = true;
	}
	if (isUpd) {
		AddonManager.getAddonByID(app, function(addon) {
			if (addon) {
					addon.findUpdates({
					onUpdateAvailable: function(aAddon, aInstall) {
						if (aAddon.permissions & AddonManager.PERM_CAN_UPGRADE && AddonManager.shouldAutoUpdate(aAddon)) {
							aInstall.install();
						}
					}
				}, AddonManager.UPDATE_WHEN_USER_REQUESTED);
			}
		});
	}
}

function checkUpdate(app, dir) {
	var ver, tag, request = new XMLHttpRequest();
	if (u0upd == 1 || uMupd == 1) {
		request.open("HEAD", "https://github.com/gorhill/" + dir + "/releases/latest");
		request.onreadystatechange = function() {
			if (this.readyState === this.DONE) {
				if ((ver = /tag\/(\d+\.\d+\.\d+)$/.exec(this.responseURL)) !== null) {
					doUpdate(app, ver[1]);
				}
			}
		}
	} else if (u0upd == 2 || uMupd == 2) {
		request.open("GET", "https://github.com/gorhill/" + dir + "/releases");
		request.responseType = "document";
		request.onload = function() {
			try {
				tag = this.responseXML.getElementsByClassName("release-title")[0].getElementsByTagName("a")[0].href;
				if ((ver = /tag\/(\d+\.\d+\.\w+)$/.exec(tag)) !== null) {
					doUpdate(app, ver[1]);
				}
			} catch (e) {}
		}
	}
	request.send();
}

function startup(data, reason) {
	var defaultBranch = Services.prefs.getDefaultBranch(branch);
	defaultBranch.setIntPref("uBlock0", 1);
	defaultBranch.setIntPref("uMatrix", 1);

	var mainBranch = Services.prefs.getBranch(branch);
	u0upd = mainBranch.getIntPref("uBlock0");
	uMupd = mainBranch.getIntPref("uMatrix");

	try { // migration, should be removed in next version
		if (mainBranch.getBoolPref("u0Beta")) {
			u0upd = 2;
			mainBranch.setIntPref("uBlock0", u0upd);
			mainBranch.clearUserPref("u0Beta");
		}
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
