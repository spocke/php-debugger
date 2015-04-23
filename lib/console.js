/**
 * Module with a console with command line, history etc.
 */
define(function(require, exports) {
	var $input, $log, history = [],
		index = 0, pendingLine = '', debugMode;

	function getConsoleLine() {
		return $input[0].innerText.trim();
	}

	function setConsoleLine(text) {
		$input.html(text.replace(/\r?\n/g, '<br>'));
		placeCaret();
	}

	function placeCaret() {
		var rng = document.createRange();
		rng.selectNodeContents($input[0]);
		rng.collapse(false);

		window.getSelection().removeAllRanges();
		window.getSelection().addRange(rng);
	}

	function addConsoleLineToHistory(line) {
		if (history.length > 0) {
			if (history[history.length - 1] == line) {
				index = history.length;
				return;
			}
		}

		history.push(line);
		index = history.length;
	}

	exports.init = function(opts) {
		debugMode = opts.debug;

		$log = $('.phpdebugger-log');
		$input = $('.phpdebugger-input div[contenteditable]');

		$('.phpdebugger-console').click(function(e) {
			if (e.target === this) {
				placeCaret();
			}
		});

		$input.on('keydown', function(e) {
			switch (e.keyCode) {
				case 13:
					if (!e.shiftKey) {
						e.preventDefault();
						exports.execute();
					}
					break;

				case 38:
					e.preventDefault();
					exports.previous();
					break;

				case 40:
					e.preventDefault();
					exports.next();
					break;
			}
		});
	};

	exports.previous = function() {
		if (index == history.length) {
			pendingLine = getConsoleLine();
		}

		if (index > 0) {
			setConsoleLine(history[--index]);
		}
	};

	exports.next = function() {
		if (index < history.length - 1) {
			setConsoleLine(history[++index]);
		} else {
			setConsoleLine(pendingLine);
			index = history.length;
		}
	};

	exports.execute = function() {
		var evt, line;

		evt = $.Event("cmd");
		line = $input[0].innerText.trim();
		$(exports).trigger(evt, [line]);

		line = line.trim();
		if (line.length > 0) {
			addConsoleLineToHistory(line);

			if (!evt.isDefaultPrevented()) {
				exports.log(line);
			}
		}

		setConsoleLine('');
		pendingLine = '';
		$input[0].scrollIntoView(false);
	};

	function logMessage(type, args) {
		var $tr, $td, text = '';

		args.forEach(function(arg) {
			if (text) {
				text += " ";
			}

			if (typeof arg == "object" || Array.isArray(arg)) {
				text += JSON.stringify(arg, null, "\t");
			} else {
				text += arg;
			}
		});

		$tr = $('<tr><td></td></tr>');
		$td = $tr.find('td').text(text);

		if (type == "error") {
			$td.addClass("alert alert-info");
		}

		if (type == "debug") {
			$td.addClass("alert alert-info");
		}

		$log.append($tr);
		$input[0].scrollIntoView(false);

		if (debugMode === true) {
			args.unshift("PHP-Debugger:");
			console.log.apply(console, args);
		}
	}

	exports.isDebugEnabled = function() {
		return debugMode === true;
	};

	exports.debug = function() {
		if (exports.isDebugEnabled()) {
			logMessage("debug", Array.prototype.slice.call(arguments));
		}
	};

	exports.log = function() {
		logMessage("info", Array.prototype.slice.call(arguments));
	};

	exports.error = function() {
		logMessage("error", Array.prototype.slice.call(arguments));
	};

	exports.clear = function() {
		$log.empty();
	};

	exports.scrollToEnd = function() {
		$input[0].scrollIntoView();
	};
});