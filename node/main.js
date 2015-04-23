/**
 * Main module for node backend.
 */

var xdebug = require("./xdebug");

function init(domainManager) {
	var domainName = "php-debugger";

	if (!domainManager.hasDomain(domainName)) {
		domainManager.registerDomain(domainName, {major: 0, minor: 1});
	}

	domainManager.registerEvent(domainName, "init");

	domainManager.registerEvent(
		domainName,
		"connect",
		[
			{
				name: "id",
				type: "string",
				description: "session id"
			}
		]
	);

	domainManager.registerEvent(
		domainName,
		"disconnect",
		[
			{
				name: "id",
				type: "string",
				description: "session id"
			}
		]
	);

	domainManager.registerEvent(
		domainName,
		"data",
		[
			{
				name: "id",
				type: "string",
				description: "session id"
			},

			{
				name: "text",
				type: "string",
				description: "Package contents from client."
			}
		]
	);

	domainManager.registerCommand(
		domainName,
		"startServer",
		xdebug.startServer,
		true,
		"Starts the xdebug server."
	);

	domainManager.registerCommand(
		domainName,
		"stopServer",
		xdebug.stopServer,
		true,
		"Stops the xdebug server."
	);

	domainManager.registerCommand(
		domainName,
		"disconnect",
		xdebug.disconnect,
		true,
		"Disconnects all connected clients."
	);

	domainManager.registerCommand(
		domainName,
		"send",
		xdebug.send,
		true
	);

	xdebug.on("connect", function(session) {
		domainManager.emitEvent(domainName, "connect", [session.id]);
	});

	xdebug.on("disconnect", function(session) {
		domainManager.emitEvent(domainName, "disconnect", [session.id]);
	});

	xdebug.on("data", function(session, text) {
		domainManager.emitEvent(domainName, "data", [
			session.id,
			text
		]);
	});
}

exports.init = init;
