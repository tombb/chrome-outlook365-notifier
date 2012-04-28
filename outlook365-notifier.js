var OUTLOOK_HOME_URL = "https://hknprd0310.outlook.com/owa/";
var OUTLOOK_LOGIN_URL = "https://login.microsoftonline.com/login.srf?wa=wsignin1.0&wreply=https:%2F%2Foutlook.com%2Fowa%2F&whr=infoxchange.net.au";
var OutlookNotifier;

YUI().use('io-base', 'node-base', function (Y) {

	OutlookNotifier = new function () {

		return {
			/**
			 * Number of unread emails we know of. When this 
			 * number increases, we'll send a desktop notification
			 */ 
			numUnreadEmails : null,

			/**
			 * Number of failed attempts to connect since
			 * the last successful one.
			 */ 
			numFailedConnections : 0,

			/**
			 * Timer object (returned by Y.later) for the periodic checks.
			 */ 
			timer : null,

			/**
			 * Whether or not the user is signed in to Outlook 365.
			 */ 
			connected: false,
	  
			/**
			 * Initializes OutlookNotifier. Starts periodic checks and subscribes
			 * the necessary event listeners
			 */ 
			init : function () {
				var 
					me = this,
					logoutPattern = OUTLOOK_LOGIN_URL.replace(
						/^https:\/\/([^\/]+)\/.*$/,'$1'
					);

				this.drawIcon("?");
				this.getUnreadEmails();

				this.timer = Y.later(60000, this, this.getUnreadEmails, {}, true);
				chrome.browserAction.onClicked.addListener(function () {
					me.openInbox();
				});
				chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
					console.log(logoutPattern);
					if (
						changeInfo.url && (
							changeInfo.url.match(OUTLOOK_HOME_URL) ||
							changeInfo.url.match(logoutPattern)
						)
					) {
						me.timer.cancel();
						me.timer = Y.later(60000, me, me.getUnreadEmails, {}, true);
						Y.later(2000, me, me.getUnreadEmails, {}, false);
					}
				});
			},

			/**
			 * Draws the browserAction icon for this extension.
			 * @param {String} txt 
			 */ 
			drawIcon : function (txt) {
				var 
					canvas = document.getElementById('iconCanvas'),
					context = canvas.getContext('2d'),
					imageObj = new Image(),
					iconURL = this.connected ? "icon19x19.png" : "icon19x19-grey.png",
					badgeColor = this.connected ? [246,101,2,200] : [105,105,105,200];
					
				imageObj.onload = function() {
					context.drawImage(imageObj, 0, 0, 19, 19);
					/* 
					context.beginPath();
					context.rect(8, 11, 10, 10);
					context.fillStyle = 'white';
					context.fill();
					context.font = "bold 8pt Arial,Sans-Serif";
					context.fillStyle = "black";
					context.shadowColor = "white";
					context.shadowOffsetX = 1; 
					context.shadowOffsetY = 1;
					context.shadowBlur = 10;
					context.fillText(txt, 10, 19);
					*/
					var imageData = context.getImageData(0, 0, 19, 19);
					chrome.browserAction.setIcon({
						imageData: imageData
					});
					chrome.browserAction.setBadgeBackgroundColor({ color: badgeColor });
					chrome.browserAction.setBadgeText({ text: txt});
					
				};
				imageObj.src = iconURL;
			},

			/**
			 * Fetches the number of unread emails in the user's inbox
			 */ 
			getUnreadEmails : function () {
				this.drawIcon("...");
				Y.io(OUTLOOK_HOME_URL, { 
					on: {
						success: function (id, response) {
							var 
								tmpNode = Y.Node.create(response.responseText),
								inboxAnchor = tmpNode.one('a[title="Inbox"]');
								inboxSpan = tmpNode.one('span[fldrnm="Inbox"]');
								inboxAnchorParent = (inboxAnchor || inboxSpan) ? (inboxAnchor || inboxSpan).ancestor('*', false) : null,
								numEmails = inboxAnchorParent ? inboxAnchorParent.get('text').replace(/[^\d]/g,'') : '?';

							if (inboxAnchorParent) {
								this.connected = true;
								if (Y.Lang.isNull(this.numUnreadEmails)) {
									this.numUnreadEmails = numEmails;
								} else if (this.numUnreadEmails < numEmails) {
									this.notify();
									this.numUnreadEmails = numEmails;
								}
								this.drawIcon(numEmails);
								chrome.browserAction.setTitle({
									title: "You have " + numEmails + " unread emails in your Outlook inbox."
								});
							} else {
								this.failureCallback(id, response);
							}
						},
						failure: this.failureCallback
					}, 
					context : this
				});
			},

			/**
			 * Failure callback for getUnreadEmails.
			 * @param {Int} id YUI IO transaction ID
			 * @param {Object} reponse YUI IO response object
			 */ 
			failureCallback : function (id, response) {
				this.connected = false;
				this.numFailedConnections += 1;
				if (this.numFailedConnections > 3) {
					this.timer.cancel();
				}
				this.drawIcon("?");
				chrome.browserAction.setTitle({
					title: "You are currently not signed in to Outlook. Click to sign in."
				});
			},

			/**
			 * Shows a desktop notification to notify the user of new email.
			 */ 
			notify : function () {
				var 
					me = this,
					notification = webkitNotifications.createHTMLNotification(
						"notification.html"
					);
				// Then show the notification.
				console.log('notify??');
				notification.onclick = function () {
					me.openInbox();
					this.cancel();
				}
				notification.show();
			},

			/**
			 * Opens Outlook in new tab unless it's opened already in the
			 * currently selected tab.
			 */ 
			openInbox : function () {
				var me = this;
				chrome.tabs.query({
					url : OUTLOOK_HOME_URL,
					windowId : chrome.windows.WINDOW_ID_CURRENT
				}, function (tabs) {
					var 
						tabsLen = tabs.length,
						active = false,
						i;
						
					for (i=0; i < tabsLen; i++) {
						if (tabs[i].active) {
							active = true;
							chrome.tabs.highlight({tabs : [tabs[i].id] }, function (w) {});
							break;
						}
					}
					if (!active) {
						chrome.tabs.create({
							url: me.connected ? OUTLOOK_HOME_URL : OUTLOOK_LOGIN_URL,
							windowId : chrome.windows.WINDOW_ID_CURRENT
						}, this.getUnreadEmails);
					}
				});
			}
		};
	};
});
