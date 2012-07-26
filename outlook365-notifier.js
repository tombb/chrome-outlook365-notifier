var OutlookNotifier;

YUI().use('io-base', 'node-base', 'array-extras', function (Y) {

	OutlookNotifier = chrome.extension.getBackgroundPage().OutlookNotifier || new function () {

		return {
			/**
			 * Template (Y.sub format) for the url of the Outlook 365 inbox
			 * @type String
			 */
			INBOX_URL_TEMPLATE : 'https://outlook.com/owa/{realm}/',

			/**
			 * We only care about these domains
			 * @type Array
			 */
			OUTLOOK_DOMAINS : [
				'outlook.com',
				'microsoftonline.com'
			],

			/**
			 * Number of unread emails we know of. When this 
			 * number increases, we'll send a desktop notification
			 * @type Int|Null
			 */ 
			numUnreadEmails : null,

			/**
			 * Number of failed attempts to connect since
			 * the last successful one.
			 * @type Int
			 */ 
			numFailedConnections : 0,

			/**
			 * Timer object (returned by Y.later) for the periodic checks.
			 * (Call cancel on this to stop the checks)
			 * @type Object
			 */ 
			timer : null,

			/**
			 * Whether or not the user is signed in to Outlook 365.
			 * @type Boolean
			 */ 
			connected: false,
	  
			/**
			 * Initializes OutlookNotifier. Starts periodic checks and subscribes
			 * the necessary event listeners
			 */ 
			init : function () {
				var me = this;

				//
				// Modify request headers to get the full version on Chromium/Unix
				// instead of the light version
				//
				if (navigator.platform.match(/Linux/i)) {
					
					chrome.webRequest.onBeforeSendHeaders.addListener(
						function(details) {
							if (me.getLinuxFullVersionPreference()) {
								for (var i = 0; i < details.requestHeaders.length; ++i) {
									if (details.requestHeaders[i].name === 'User-Agent') {
										console.log(details.requestHeaders[i].value);
										console.log(details.url);
										details.requestHeaders[i].value = 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/536.5 (KHTML, like Gecko) Chrome/20.0.1132.47 Safari/536.5';
										//'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:12.0) Gecko/20100101 Firefox/12.0';
										break;
									}
								}
								return {requestHeaders: details.requestHeaders};
							}
						},
						{
							urls: /*["<all_urls>"]*/ Y.Array.map(
								me.OUTLOOK_DOMAINS, 
								function (e) {  return "*://*." + e + "/*" }
							)
						},
						["blocking", "requestHeaders"]
					);
				}
				
				this.drawIcon("?");

				//
				// First attempt to get number of unread emails (and show them in the
				// icon).
				//
				this.getUnreadEmails();

				//
				// From now on check for new emails every minute
				//
				this.timer = Y.later(60000, this, this.getUnreadEmails, {}, true);

				//
				// Open inbox when the icon is clicked
				//
				chrome.browserAction.onClicked.addListener(function () {
					me.openInbox();
				});

				//
				// Update icon when logging in/out of Outlook
				//
				chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
					if (changeInfo.url) {
						if (Y.Array.find(me.OUTLOOK_DOMAINS, function (e) {
							return changeInfo.url.match(new RegExp('https?:\/\/.*\.' + e));
						})) {
							if (
								changeInfo.url.match(/realm=([^&=]+)/) ||
								changeInfo.url.match(/whr=([^&=]+)/)
							) {
								localStorage['outlook_inbox_url'] = Y.Lang.sub(
									me.INBOX_URL_TEMPLATE,
									{ realm : RegExp.$1 }
								);
							}
							me.timer.cancel();
							me.timer = Y.later(60000, me, me.getUnreadEmails, {}, true);
							Y.later(5000, me, me.getUnreadEmails, {}, false);
						}
					}
				});

				
				//
				// NOTE: Receiving messages from content script - can use this
				// to update icon when user is opening emails etc.
				//
				//chrome.extension.onRequest.addListener(
				//	function(request, sender, sendResponse) {
				//		if (request.url) {
				//			
				//		}
				//	}
				//);
			},
	  
			/**
			 * NOTE: Sending messages from content scripts - can use
			 * to update icon when user is opening emails etc.
			 * 
			detectInbox : function (tabId) {
				if (!this.getInboxURL()) {
					chrome.tabs.executeScript(tabId, {
						code: "if (document.title.match('Outlook Web App')) { chrome.extension.sendRequest({url: document.location.href}) }"
					});
				}
			},
			**/

			/**
			 * Returns the URL of our outlook inbox
			 */ 
			getInboxURL : function () {
				return localStorage['outlook_inbox_url'];
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
					/** 
					 * Was using this to draw number initially - decided
					 * to go for badge instead - keeping around as I might
					 * use to draw different icon for calendar notifiactions
					 * 
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
					**/
					var imageData = context.getImageData(0, 0, 19, 19);
					chrome.browserAction.setIcon({
						imageData: imageData
					});
					chrome.browserAction.setBadgeBackgroundColor({ color: badgeColor });
					chrome.browserAction.setBadgeText({ text: txt || "0"});
					
				};
				imageObj.src = iconURL;
			},

			/**
			 * Fetches the number of unread emails in the user's inbox using
			 * an XHR request. Updates the icon and launches a notification if
			 * needed / applicable.
			 * @returns {Void}
			 */ 
			getUnreadEmails : function (xhr) {
				if (this.getInboxURL()) {
					this.drawIcon("...");
					Y.io(this.getInboxURL(), { 
						on: {
							success: function (id, response) {
								var 
									tmpNode = Y.Node.create(response.responseText),
									inboxAnchor = tmpNode.one('a[title="Inbox"]'),
									inboxSpan = tmpNode.one('span[fldrnm="Inbox"]'),
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
										title: "You have " + (numEmails || '0') + " unread emails in your Outlook inbox."
									});
								} else {
									this.failureCallback(id, response);
								}
								
								//
								// Clean up
								//
								tmpNode.destroy(true);
								inboxAnchor && inboxAnchor.destroy(true);
								inboxSpan && inboxSpan.destroy(true);
								inboxAnchorParent.destroy(true);
							},
							failure: this.failureCallback
						}, 
						context : this
					});
				}
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
			 * Returns the users desktop notification preference. True means
			 * they want desktop notifications - False means they don't.
			 * @returns Boolean
			 */ 
			getNotificationPreference : function () {
				if (Y.Lang.isValue(localStorage['outlook_desktop_notifications_email'])) {
					return localStorage['outlook_desktop_notifications_email'] === '1';
				}
				return true;
			},

			/**
			 * Returns the user's full version preference. True mean they want to use 
			 * the full version on Linux, false means they don't.
			 * @returns Boolean
			 */ 
			getLinuxFullVersionPreference : function () {
				if (Y.Lang.isValue(localStorage['outlook_linux_full_version'])) {
					return localStorage['outlook_linux_full_version'] === '1';
				}
				return navigator.platform.match(/Linux/i);
			},

			/**
			 * Shows a desktop notification to notify the user of new email.
			 */ 
			notify : function () {
				if (this.getNotificationPreference()) {
					if (this.notification) {
						this.notification.cancel();
					}
				
					this.notification = webkitNotifications.createHTMLNotification(
						"notification.html"
					);

					this.notification.show();
				}
			},

			/**
			 * Opens Outlook in new tab unless it's opened already in the
			 * currently selected tab.
			 */ 
			openInbox : function () {
				var me = this;
				if (!me.getInboxURL()) {
					chrome.tabs.create({
						url: '/options.html',
						windowId : chrome.windows.WINDOW_ID_CURRENT
					});
				} else {
					chrome.tabs.query({
						url : this.getInboxURL(),
						windowId : chrome.windows.WINDOW_ID_CURRENT
					}, function (tabs) {
						var 
							tabsLen = tabs.length,
							active = false,
							i;
							
						for (i=0; i < tabsLen; i++) {
							if (tabs[i].active) {
								active = true;
								break;
							}
						}
						if (!active) {
							chrome.tabs.create({
								url: me.getInboxURL(),
								windowId : chrome.windows.WINDOW_ID_CURRENT
							}, this.getUnreadEmails);
						}
					});
				}
			}
		};
	};
});

