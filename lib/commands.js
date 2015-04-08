/**
 * Module with all commands that the UI/User can execute.
 */
define(function(require, exports) {
	var console = require("./console"),
		xdebug = require("./xdebug"),
		editor = require("./editor"),
		tree = require("./tree"),
		util = require("./util"),
		panel = require("./panel"),
		isActive;

	exports.clear = function() {
		return console.clear();
	};

	exports.run = function() {
		return xdebug.execute("run");
	};

	exports.step_into = function() {
		return xdebug.execute("step_into");
	};

	exports.step_over = function() {
		return xdebug.execute("step_over");
	};

	exports.step_out = function() {
		return xdebug.execute("step_out");
	};

	exports.stop = function() {
		return xdebug.disconnect();
	};

	exports.removeBreakPoint = function(args) {
		editor.removeBreakPoint(args);
	};

	exports.setStackContext = function(args, $div) {
		var $content = $div.parents().filter(".phpdebugger-content");

		$content.find(".phpdebugger-line").removeClass("phpdebugger-line-active");
		$div.addClass("phpdebugger-line-active");

		//editor.gotoLine(args.fullPath, args.line);
		editor.setActiveLine(args.fullPath, args.line);

		if (typeof args.level == "number") {
			return xdebug.execute("context_get", {
				d: args.level
			}).done(function($elm) {
				var property = util.propertyToJson($elm);

				property.type = "context";
				panel.updateLocalsView(property, args.level);
			});
		}
	};

	exports.toggleBreakPoint = function(args) {
		editor.toggleBreakPoint(args.line);
	};

	exports.gotoBreakPoint = function(args) {
		editor.gotoLine(args.fullPath, args.line);
	};

	exports.expandProperty = function(args, $div) {
		$div.attr('data-phpdebugger-cmd', ''); // Expand only once

		xdebug.execute("property_get", {
			n: args.fullName,
			d: args.level
		}).done(function($elm) {
			var treeNode, property;

			property = util.propertyToJson($elm);
			treeNode = tree.fromProperty(property.children[0], args.level);
			tree.TreeNode.renderChildrenTo(treeNode.children, $div);
		});
	};

	exports.toggle = function() {
		isActive = !isActive;

		if (isActive) {
			exports.open();
		} else {
			exports.close();
		}
	};

	exports.open = function() {
		isActive = true;
		panel.toggle(true);
		console.clear();
		xdebug.startServer();
		$("#editor-holder").addClass("php-debugger");
		editor.refresh();
	};

	exports.close = function() {
		isActive = false;
		console.clear();
		xdebug.stopServer();
		panel.toggle(false);
		$("#editor-holder").removeClass("php-debugger");
		editor.refresh();
	};

	exports.init = function() {
		var consoleCommands = ["clear", "stop", "step_into", "step_over", "step_out", "run"];

		$(console).on("cmd", function(e, line) {
			var args, cmd;

			// Only execute exposed commands
			args = line.trim().split(" ");
			if (consoleCommands.indexOf(args[0].toLowerCase()) != -1) {
				cmd = exports[args[0]];

				if (cmd) {
					e.preventDefault();
					cmd(args.slice(1));
				}
			} else {
				if (!xdebug.isConnected()) {
					e.preventDefault();
					console.error("An active debugging session is required for code evaluation.");
					return;
				}

				xdebug.execute("feature_set", {
					n: "max_depth",
					v: 3
				}).done(function() {
					xdebug.execute("eval", {data: line}).done(function($elm) {
						var property = util.propertyToJson($elm);

						if (property.children) {
							if (property.children[0].type == "array" || property.children[0].type == "object") {
								tree.fromProperty(property.children[0], -1).renderTo($(".phpdebugger-console td:last")[0]);
							} else {
								$("<div>").text("" + property.children[0].value).appendTo($(".phpdebugger-console td:last"));
							}
						}

						console.scrollToEnd();
					}).always(function() {
						xdebug.execute("feature_set", {
							n: "max_depth",
							v: 1
						});
					});
				});
			}
		});
	};
});