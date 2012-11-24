//
// Export
//
var AppNotifier;

YUI().use('base-notifier', function (Y) {

	/**
	 * @constructor
	 */ 
	AppNotifier = function () {
		arguments.callee.superclass.constructor.apply(this, arguments);
	};

	AppNotifier.NAME = "AppNotifier";

	//
	// Attributes
	//
	AppNotifier.ATTRS = {
		/**
		 * The title of your extension
		 */ 
		title : {
			value : 'Outlook 365 Notifier'
		},

		/**
		 * The URL of the app
		 */ 
		url : {
			getter : function () {
				return localStorage.outlook_inbox_url;
			}
		},
		
		/**
		 * Known domains for the app. Domains here must be listed under
		 * permissions in your manifest.json.
		 */ 
		domains : {
			value : [
				'outlook.com',
				'microsoftonline.com'
			]
		},

		/**
		 * Text to display to the user
		 */
		text : {
			value : {
				success     : 'You have {num} unread emails in your Outlook 365 inbox.',
				notLoggedIn : 'You are currently not signed in to Outlook 365. Click to sign in.',
				notificationTitle : 'New email!'
			}
		},

		/**
		 * The user's desktop notifications preference. True means they want 
		 * desktop notifications - False means they don't.
		 */ 
		notificationPreference : {
			getter : function () {
				if (Y.Lang.isValue(localStorage.outlook_desktop_notifications_email)) {
					return localStorage.outlook_desktop_notifications_email === '1';
				}
				return true;
			}
		},

		/**
		 * Icon to display while the user is logged in
		 */ 
		icons : {
			value : {
				loggedIn : 'browser-action-icon-active.png',
				notLoggedIn : 'browser-action-icon-inactive.png',
				notification : 'outlook.ico'
			}
		},

		/**
		 * The font color of the icon while logged in
		 */ 
		loggedInColor : {
			value : [246,101,2,200]
		}
	};

	Y.extend(AppNotifier, BaseNotifier, {

		/**
		 * Initialize Outlook 365 Notifier. The only thing we add here on top
		 * of base functionality is overriding request headers to allow Linux users
		 * to use the full version
		 */ 
		initializer : function () {
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
									details.requestHeaders[i].value = 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/536.5 (KHTML, like Gecko) Chrome/22.0.1229.79 Safari/537.4';
									break;
								}
							}
							return {requestHeaders: details.requestHeaders};
						}
					},
					{
						urls: Y.Array.map(
							me.get('domains'), 
							function (e) {  return "*://*." + e + "/*"; }
						)
					},
					["blocking", "requestHeaders"]
				);
			}
		},

		/**
			* Returns the user's full version preference. True mean they want to use 
			* the full version on Linux, false means they don't.
			* @returns Boolean
			*/ 
		getLinuxFullVersionPreference : function () {
			if (Y.Lang.isValue(localStorage.outlook_linux_full_version)) {
				return localStorage.outlook_linux_full_version === '1';
			}
			return navigator.platform.match(/Linux/i);
		},

		/**
		 * Get the number of unread email from the page using CSS selectors etc.
		 */ 
		getNumberFromNode : function (tmpNode) {
			var
				inboxAnchor = tmpNode.one('a[title="Inbox"]'),
				inboxSpan = tmpNode.one('span[fldrnm="Inbox"]'),
				inboxAnchorParent = (inboxAnchor || inboxSpan) ? (inboxAnchor || inboxSpan).ancestor('*', false) : null,
				newNumber = inboxAnchorParent ? inboxAnchorParent.get('text').replace(/[^\d]/g,'') : null;

			//
			// cleanup
			//
			if (inboxAnchor) {
				inboxAnchor.destroy(true);
			}
			if (inboxSpan) {
				inboxSpan.destroy(true);
			}
			if (inboxAnchorParent) {
				inboxAnchorParent.destroy(true);
			}
			return newNumber;
		},
		
		/**
		 * Auto-detect the realm and store it in localStorage
		 */
		onAppReload : function (tabId, changeInfo, tab) {
			if (
				changeInfo.url.match(/realm=([^&=]+)/) ||
				changeInfo.url.match(/whr=([^&=]+)/)
			) {
				localStorage.outlook_inbox_url = Y.Lang.sub(
					this.get('url'),
					{ realm : RegExp.$1 }
				);
			}
			AppNotifier.superclass.onAppReload.apply(this, arguments);
		},

		/**
		 * Go to options page if the user hasn't set a URL yet
		 */ 
		openApp : function () {
			if (!this.get('url')) {
				chrome.tabs.create({
					url: '/options.html',
					windowId : chrome.windows.WINDOW_ID_CURRENT
				});
			} else {
				AppNotifier.superclass.openApp.apply(this, arguments);
			}
		}
	});
});

