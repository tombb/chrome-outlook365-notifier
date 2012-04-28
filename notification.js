YUI().use('node-base', function (Y) {
	Y.one('#txt-ctnr').setHTML(
		'You have <b>' +
		chrome.extension.getBackgroundPage().OutlookNotifier.numUnreadEmails + 
		'</b> unread emails in your Outlook Inbox.'
	);
});