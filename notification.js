YUI().use('node-base', function (Y) {
	Y.one('#txt-ctnr').setHTML(
		'You have <b>' +
		OutlookNotifier.numUnreadEmails + 
		'</b> unread emails in your Outlook Inbox.'
	).on('click', function () {
		OutlookNotifier.openInbox();
		OutlookNotifier.notification.cancel();
	});
	
});