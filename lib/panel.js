/**
 * Module for handling UI panel. Show/hide, update views etc.
 */
define(function(require, exports, module) {
	var WorkspaceManager = brackets.getModule("view/WorkspaceManager"),
		tree = require("./tree"),
		util = require("./util"),
		panel;

	exports.init = function() {
		panel = WorkspaceManager.createBottomPanel(module.id + ".panel", $(require("text!bottom-panel.html")), 210);

		$("#phpdebugger-panel").on("click", "[data-phpdebugger-cmd]", function(e) {
			var cmd = $(this).attr("data-phpdebugger-cmd");

			if (this.disabled) {
				return;
			}

			if (cmd) {
				e.stopPropagation();

				var args = $(this).attr("data-phpdebugger-args");
				if (args) {
					args = JSON.parse($(this).attr("data-phpdebugger-args"));
				}

				$(exports).trigger("cmd", {
					cmd: cmd,
					args: args,
					elm: $(this)
				});
			}
		});

		$(".phpdebugger-panel").on("click", "h4", function() {
			$(this).parent().toggleClass("phpdebugger-collapsed");
		});

		exports.reset();
	};

	exports.toggle = function(state) {
		if (typeof state === "undefined") {
			state = !panel.isVisible();
		}

		panel.setVisible(state);
		$(exports).trigger("stateChange", state);

		// Workaround for scroll and resize issue with side panel
		if (state) {
			var $content = $('#phpdebugger-content');
			var $panel = $('#phpdebugger-panel');
			var $toolbar = $('#phpdebugger-panel > .toolbar');

			if (!$content[0].style.height) {
				$content.height($panel.height() - $toolbar.height());
			}
		}
	};

	exports.updateStackView = function(stack) {
		var $content = $(".phpdebugger-stack .phpdebugger-content").empty();

		stack.forEach(function(item, i) {
			var $line = $('<div class="phpdebugger-line">');

			if (i === 0) {
				$line.addClass("phpdebugger-line-active");
			}

			util.attachCommand($line, "setStackContext", {
				fullPath: item.filename,
				line: item.lineno - 1,
				level: item.level
			});

			$line.attr("title", item.filename);
			$line.text(item.where + " " + util.shorten(item.filename, 64) + ":" + item.lineno);

			$content.append($line);
		});
	};

	exports.updateLocalsView = function(locals, level) {
		tree.fromProperty(locals, level).renderTo($(".phpdebugger-locals .phpdebugger-content").empty()[0]);
	};

	exports.updateSuperGlobalsView = function(globals) {
		globals.forEach(function(global) {
			var treeNode = tree.fromProperty(global);

			treeNode.renderTo($(".phpdebugger-globals .phpdebugger-content").empty()[0]);
		});
	};

	exports.updateBreakPointsView = function(breakpoins) {
		var $content = $(".phpdebugger-breakpoints .phpdebugger-content").empty();

		if (breakpoins.length === 0) {
			$content.append('<div class="phpdebugger-msg">No breakpoints</div>');
		} else {
			breakpoins.forEach(function(breakpoint) {
				var $line = $('<div class="phpdebugger-line">');

				util.attachCommand($line, "gotoBreakPoint", {
					fullPath: breakpoint.fullPath,
					line: breakpoint.line
				});

				$line.attr("title", breakpoint.fullPath);
				$line.text(util.shorten(breakpoint.fullPath, 64) + ":" + (breakpoint.line + 1));

				var $removeBreakPoint = $('<a class="phpdebugger-breakpoint-remove close">&times;</a>');

				util.attachCommand($removeBreakPoint, "removeBreakPoint", {
					fullPath: breakpoint.fullPath,
					line: breakpoint.line
				});

				$line.prepend($removeBreakPoint);

				$content.append($line);
			});
		}
	};

	exports.reset = function() {
		$(".phpdebugger-stack .phpdebugger-content").html('<div class="phpdebugger-msg">Not paused</div>');
		$(".phpdebugger-locals .phpdebugger-content").html('<div class="phpdebugger-msg">Not paused</div>');
		$(".phpdebugger-globals .phpdebugger-content").html('<div class="phpdebugger-msg">Not paused</div>');
		$(".phpdebugger-content .phpdebugger-line-active").removeClass("phpdebugger-line-active");
	};

	exports.enableToolbar = function() {
		$("#phpdebugger-panel .toolbar button").prop("disabled", false);
	};

	exports.disableToolbar = function() {
		$("#phpdebugger-panel .toolbar button").prop("disabled", true);
	};
});