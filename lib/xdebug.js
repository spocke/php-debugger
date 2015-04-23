/**
 * Module that talks to xdebug through the nodejs backend.
 */
define(function(require, exports) {
	var _nodeDomain,
		console = require("./console"),
		editor = require("./editor"),
		panel = require("./panel"),
		util = require("./util"),
		sessions = {},
		currentSessionId,
		transactCount = 0,
		contextNames,
		commandPromises = {},
		port = 9000,
		idekey = "xdebug";

	function execNodeCommand(name, args) {
		return _nodeDomain.exec(name, args).fail(function(err) {
			console.error("Failed to execute command: ", name, err.message);
		});
	}

	function startServer() {
		return execNodeCommand("startServer", [port]).done(function() {
			console.log("Server started listening on port: " + port + " idekey: " + idekey);
		});
	}

	function stopServer() {
		return execNodeCommand("stopServer").then(function() {
			console.debug("Server stopped.");
		});
	}

	function disconnect() {
		return execNodeCommand("disconnect");
	}

	function send(data) {
		return execNodeCommand("send", [currentSessionId, data]);
	}

	function execute(name, args) {
		var transactionId, command = [name], key, data, promise;

		transactionId = "t-" + (transactCount++);

		args = args || {};
		args.i = transactionId;
		data = args.data;
		delete args.data;

		for (key in args) {
			if (typeof args[key] != "undefined") {
				command.push(" -" + key + " " + args[key]);
			}
		}

		if (typeof data !== "undefined" && data !== null) {
			command.push(" -- " + btoa(data));
		}

		promise = $.Deferred();
		commandPromises[transactionId] = promise;

		if (console.isDebugEnabled()) {
			window.console.debug(command.join(""));
		}

		send(command.join(""));

		return promise;
	}

	function handleInit($elm) {
		var language, initIdeKey, breakPointPropmises = [];

		language = $elm.attr("language");
		initIdeKey = $elm.attr("idekey");

		if (language != "PHP") {
			console.error("Language isn't PHP: " + language);
			disconnect();
			return;
		}

		// Very ide keys
		if (initIdeKey.split(",").indexOf(idekey) === -1) {
			console.error("Ide key doesn't match: " + initIdeKey);
			disconnect();
			return;
		}

		var breakPoints = editor.getBreakPoints();

		// No breakpoints then what"s the point?
		if (breakPoints === 0) {
			disconnect();
			return;
		}

		// Set all breakpoints
		breakPoints.forEach(function(breakPoint) {
			var promise = execute("breakpoint_set", {
				t: "line",
				f: breakPoint.fullPath,
				n: breakPoint.line + 1
			});

			promise.done(function($elm) {
				breakPoint.serverId = $elm.attr("id");
			});

			breakPointPropmises.push(promise);
		});

		// Execute run when they are all set
		$.when.apply($, breakPointPropmises).done(function() {
			execute("run");
		});
	}

	function handleResponse($elm) {
		var transaction_id, promise;

		transaction_id = $elm.attr("transaction_id");
		promise = commandPromises[transaction_id];
		if (promise) {
			delete commandPromises[transaction_id];
			promise.resolve($elm);
		}
	}

	function updateSuperGlobalsView() {
		execute("context_get", {
			c: contextNames.Superglobals
		}).done(function($elm) {
			var property = util.propertyToJson($elm);

			property.type = "context";

			panel.updateSuperGlobalsView([
				property
			]);
		});
	}

	function updateLocalsView() {
		execute("context_get").done(function($elm) {
			var property = util.propertyToJson($elm);

			property.type = "context";

			panel.updateLocalsView(property);
		});
	}

	function updateStackView() {
		execute("stack_get").done(function($elm) {
			var stack = [];

			$elm.find("stack").each(function() {
				var $stack = $(this);

				stack.push({
					where: $stack.attr("where"),
					filename: util.toEditorPath($stack.attr("filename")),
					lineno: parseInt($stack.attr("lineno"), 10),
					level: parseInt($stack.attr("level"), 10)
				});
			});

			panel.updateStackView(stack);
			updateLocalsView();

			if (!contextNames) {
				execute("context_names", {d: 0}).done(function($elm) {
					contextNames = {};

					$elm.find("context").each(function() {
						contextNames[$(this).attr("name")] = $(this).attr("id");
					});

					updateSuperGlobalsView();
				});
			} else {
				updateSuperGlobalsView();
			}
		});
	}

	function moveToBreakLine($elm) {
		var $message = $elm.find("message"),
			fileName = $message.attr("filename"),
			lineNo = parseInt($message.attr("lineno"), 10);

		if (fileName) {
			editor.setActiveLine(fileName, lineNo - 1);
		}
	}

	function init(opts) {
		_nodeDomain = opts.nodeDomain;

		port = opts.port || port;
		idekey = opts.idekey || idekey;

		_nodeDomain.on("data", function(e, id, text) {
			var session, parser, doc, $elm, $error;

			if (id != currentSessionId) {
				return;
			}

			session = sessions[id];
			parser = new DOMParser();
			doc = parser.parseFromString(text, "application/xml");
			$elm = $(doc.documentElement);
			session.status = $elm.attr("status");

			switch ($elm[0].nodeName) {
				case "init":
					handleInit($elm);
					break;

				case "response":
					handleResponse($elm);
					break;
			}

			$error = $elm.children().filter("error");
			if ($error.length) {
				console.error($error.find("message").text());
			}

			if (session.status == "break") {
				moveToBreakLine($elm);
				updateStackView();
			}

			if (session.status == "stopping") {
				disconnect();
			}

			if (opts.debug) {
				window.console.log($elm[0]);
			}
		});

		_nodeDomain.on("connect", function(e, id) {
			// Only handle one debugging session at a time
			if (currentSessionId && id != currentSessionId) {
				console.debug("ignore connect", id);
				return;
			}

			sessions[id] = {};
			currentSessionId = id;
			console.debug("connect", id);
			panel.enableToolbar();
		});

		_nodeDomain.on("disconnect", function(e, id) {
			delete sessions[id];

			// Only handle one debugging session at a time
			if (id == currentSessionId) {
				currentSessionId = null;
				console.debug("disconnect", id);
				editor.clearActiveLine();
				panel.reset();
				panel.disableToolbar();
				editor.closeCurrentViewEditor();
			} else {
				console.debug("ignore disconnect", id);
			}
		});
	}

	function isConnected() {
		return !!currentSessionId && sessions[currentSessionId] && sessions[currentSessionId].status !== "stopping";
	}

	$.extend(exports, {
		init: init,
		startServer: startServer,
		stopServer: stopServer,
		disconnect: disconnect,
		execute: execute,
		send: send,
		isConnected: isConnected
	});
});