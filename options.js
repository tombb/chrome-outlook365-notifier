YUI().use('event-base','node-style', 'array-extras', function (Y) {

	Y.on('domready', function () {
		//
		// Show a welcome message if we're here for the first time 
		//
		if (!localStorage.outlook_inbox_url) {
			Y.one('h1').setHTML('Welcome to Outlook 365 Notifier');
		}

		//
		// URL
		//
		Y.one('input[name="outlook_inbox_url"]')
			.set(
				'value',
				localStorage.outlook_inbox_url || 'https://outlook.com/owa/<your.company.com>'
			)
			.on('keyup', function (e) {
				localStorage.outlook_inbox_url = e.target.get('value');
			});
		Y.one('#go-to-inbox-btn').on('click', function () {
			chrome.extension.getBackgroundPage().NOTIFIER.openApp();
		});

		//
		// Notifications
		//	
		Y.all('input[name="outlook_desktop_notifications_email"]')
			.each(function (el) {
				if (Y.Lang.isValue(localStorage.outlook_desktop_notifications_email)) {
					if (localStorage.outlook_desktop_notifications_email === el.get('value')) {
						el.set('checked', true);
					} else {
						el.set('checked', false);
					}
				}
				el.on('click', function (e) {
					localStorage.outlook_desktop_notifications_email = e.target.get('value');
				});
			});

		//
		// Linux Full/light version preference
		//
		if (navigator.platform.match(/linux/i)) {
			Y.one('#linux-full-version-section').setStyle('display', '');
		}
		Y.all('input[name="outlook_linux_full_version"]')
			.each(function (el) {
				if (Y.Lang.isValue(localStorage.outlook_linux_full_version)) {
					if (localStorage.outlook_linux_full_version === el.get('value')) {
						el.set('checked', true);
					} else {
						el.set('checked', false);
					}
				}
				el.on('click', function (e) {
					localStorage.outlook_linux_full_version = e.target.get('value');
					chrome.cookies.getAll({}, function (cookies) {
						Y.Array.each(cookies, function(e) {
							var prefix = e.secure ? "https://" : "http://", domain;
							domain = e.domain.replace(/^\./,'');
							prefix += "";
							chrome.cookies.remove({name : e.name, url: prefix + domain + e.path});
						});
					});
				});
			});
	});
});