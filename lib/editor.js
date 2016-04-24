/**
 * Module for handling editor integration breakpoints, active line, open/close documents etc.
 */
define(function(require, exports) {
	var CommandManager = brackets.getModule("command/CommandManager"),
		Commands = brackets.getModule("command/Commands"),
		EditorManager = brackets.getModule("editor/EditorManager"),
		DocumentManager = brackets.getModule("document/DocumentManager"),
		console = require("./console"),
		panel = require("./panel"),
		util = require("./util");

	var currentDocFullPath, currentDocActiveLine = 0, breakPoints = [];
	var gutterName = "php-debugger-bp-gutter", gutterIdCount = 0, currentViewPath;

	function isActive() {
		return $("#editor-holder").hasClass("php-debugger");
	}

	function createBreakPoint(fullPath, lineNo) {
		return {
			fullPath: fullPath,
			line: lineNo,
			id: gutterName + "-" + (gutterIdCount++)
		};
	}

	function toggleActiveLine(editor, lineNo, state) {
		if (!editor || lineNo === -1) {
			return;
		}

		if (state) {
			editor._codeMirror.addLineClass(
				lineNo,
				"background",
				"php-debugger-highlight-background"
			);
		} else {
			editor._codeMirror.removeLineClass(
				lineNo,
				"background",
				"php-debugger-highlight-background"
			);
		}
	}

	function renderBreakPoint(breakPoint) {
		var cm = EditorManager.getActiveEditor()._codeMirror;

		var $marker = $("<div>")
			.addClass(gutterName)
			.prop("id", breakPoint.id)
			.html("●");

		cm.setGutterMarker(
			breakPoint.line,
			gutterName,
			$marker[0]
		);
	}

	function removeBreakPoint(breakPoint) {
		var cm;

		if (EditorManager.getActiveEditor()) {
			cm = EditorManager.getActiveEditor()._codeMirror;
		}

		for (var i = 0; i < breakPoints.length; i++) {
			if (breakPoints[i].line == breakPoint.line && breakPoints[i].fullPath == breakPoint.fullPath) {
				if (cm) {
					cm.setGutterMarker(
						breakPoint.line,
						gutterName,
						null
					);
				}

				$(exports).trigger("breakPointRemoved", breakPoints[i]);
				breakPoints.splice(i, 1);
				panel.updateBreakPointsView(breakPoints);
				return true;
			}
		}
	}

	function isValidBreakPointLine(lineText) {
		lineText = lineText.trim();

		// Don"t add breakpoints on empty or commented lines
		// TODO: Make this smarter check for /**/ comments etc
		if (lineText.length === 0 || lineText.indexOf("//") === 0) {
			return false;
		}

		return true;
	}

	function toggleBreakPoint(lineNo) {
		var cm = EditorManager.getActiveEditor()._codeMirror,
			fullPath = EditorManager.getActiveEditor().getFile().fullPath;

		if (removeBreakPoint({fullPath: fullPath, line: lineNo})) {
			return;
		}

		if (!isValidBreakPointLine(cm.lineInfo(lineNo).text)) {
			return;
		}

		var breakPoint = createBreakPoint(fullPath, lineNo);

		breakPoints.push(breakPoint);

		renderBreakPoint(breakPoint);
		panel.updateBreakPointsView(breakPoints);

		$(exports).trigger("breakPointAdded", breakPoint);
	}

	function gutterClick(cm, lineNo, gutterId) {
		if (gutterId !== gutterName && gutterId !== "CodeMirror-linenumbers") {
			return;
		}

		if (isActive()) {
			toggleBreakPoint(lineNo);
		}
	}

	function getDocumentBreakPoints() {
		return breakPoints.filter(function(breakPoint, index) {
			breakPoint.index = index;

			return breakPoint.fullPath == currentDocFullPath;
		});
	}

	function removeUnusedGutterMarkers(editor) {
		var gutterLines = [], documentBreakPoints = getDocumentBreakPoints(),
			lineNo = 0, lineInfo, gutterMarker, cm = editor._codeMirror;

		while ((lineInfo = cm.lineInfo(lineNo++)) !== null) {
			if (lineInfo.gutterMarkers) {
				gutterMarker = lineInfo.gutterMarkers[gutterName];

				// Reposition breakpoint
				if (gutterMarker) {
					gutterLines.push({
						marker: gutterMarker,
						line: lineNo
					});
				}
			}
		}

		gutterLines.forEach(function(gutterInfo) {
			for (var i = 0; i < documentBreakPoints.length; i++) {
				if (documentBreakPoints[i].id === gutterInfo.marker.id) {
					return;
				}
			}

			cm.setGutterMarker(
				gutterInfo.line - 1,
				gutterName,
				null
			);
		});
	}

	function change(cm) {
		var documentBreakPoints = getDocumentBreakPoints();

		if (documentBreakPoints.length > 0) {
			var lineNo = 0, lineInfo, gutterMarker;

			while ((lineInfo = cm.lineInfo(lineNo++)) !== null) {
				if (lineInfo.gutterMarkers) {
					gutterMarker = lineInfo.gutterMarkers[gutterName];

					// Skip invalid ones so they get removed
					if (!isValidBreakPointLine(lineInfo.text)) {
						cm.setGutterMarker(
							lineNo - 1,
							gutterName,
							null
						);

						continue;
					}

					// Reposition breakpoint
					if (gutterMarker) {
						for (var i = 0; i < documentBreakPoints.length; i++) {
							if (documentBreakPoints[i].id === gutterMarker.id) {
								documentBreakPoints[i].line = lineNo - 1;
								documentBreakPoints.splice(i, 1);
								break;
							}
						}
					}
				}
			}

			// Remove any non treated items
			documentBreakPoints.forEach(function(breakPoint) {
				breakPoints.splice(breakPoint.index, 1);
			});

			panel.updateBreakPointsView(breakPoints);
		}

		$(exports).trigger("change");

		if (currentViewPath) {
			currentViewPath = null;
		}
	}

	function renderBreakPoints(editor) {
		var cm = editor._codeMirror,
			gutters = cm.getOption("gutters").slice(0);

		if (gutters.indexOf(gutterName) === -1) {
			gutters.unshift(gutterName);
			cm.setOption("gutters", gutters);
			cm.on("gutterClick", gutterClick);
			cm.on("change", change);
		}

		breakPoints.forEach(function(breakPoint) {
			if (breakPoint.fullPath == editor.getFile().fullPath) {
				renderBreakPoint(breakPoint);
			}
		});
	}

	function closeCurrentViewEditor() {
		if (currentViewPath) {
			DocumentManager.getAllOpenDocuments().forEach(function(doc) {
				if (util.comparePaths(doc.file.fullPath, currentViewPath)) {
					currentViewPath = null;

					CommandManager.execute(Commands.FILE_CLOSE, {
						file: doc.file
					});
				}
			});
		}
	}

	function open(fullPath) {
		var deferred = $.Deferred(), isOpen;

		fullPath = util.toEditorPath(fullPath);

		DocumentManager.getAllOpenDocuments().forEach(function(doc) {
			if (util.comparePaths(doc.file.fullPath, fullPath)) {
				isOpen = true;
			}
		});

		var activeEditor = EditorManager.getActiveEditor();
		if (activeEditor && util.comparePaths(activeEditor.getFile().fullPath, fullPath)) {
			currentDocFullPath = fullPath;
			deferred.resolve(activeEditor);
			return deferred;
		}

		closeCurrentViewEditor();

		CommandManager.execute(Commands.CMD_OPEN, {
			fullPath: fullPath,
			paneId: "first-pane",
			options: {
				noPaneActivate: true
			}
		}).done(function() {
			if (!isOpen) {
				currentViewPath = EditorManager.getActiveEditor().getFile().fullPath;
			}

			currentDocFullPath = fullPath;
			deferred.resolve(EditorManager.getActiveEditor());
		});

		return deferred;
	};

	exports.gotoLine = function(fullPath, lineNo) {
		if (!util.canOpenRemotePath(fullPath)) {
			console.log("Cannot open remote path: " + util.toEditorPath(fullPath) + " @ line " + lineNo);
			return;
		}

		return open(fullPath).done(function(editor) {
			editor.setCursorPos(lineNo);
			editor.focus();
		});
	};

	exports.setActiveLine = function(fullPath, lineNo) {
		if (!util.canOpenRemotePath(fullPath)) {
			console.log("Cannot show remote path: " + util.toEditorPath(fullPath) + " @ line " + lineNo);
			return;
		}

		return open(fullPath).done(function(editor) {
			editor.setCursorPos(lineNo);
			toggleActiveLine(editor, currentDocActiveLine, false);
			toggleActiveLine(editor, lineNo, true);
			currentDocActiveLine = lineNo;
		});
	};

	exports.clearActiveLine = function() {
		var editor = EditorManager.getActiveEditor();

		if (editor) {
			toggleActiveLine(editor, currentDocActiveLine, false);
			currentDocActiveLine = 0;
		}
	};

	exports.removeBreakPoint = removeBreakPoint;

	exports.getBreakPoints = function() {
		return breakPoints;
	};

	exports.refresh = function() {
		var active = EditorManager.getActiveEditor();

		if (active) {
			active._codeMirror.refresh();
		}
	};

	exports.init = function() {
		panel.updateBreakPointsView(breakPoints);
	};

	exports.closeCurrentViewEditor = closeCurrentViewEditor;
	exports.toggleBreakPoint = toggleBreakPoint;

	$(EditorManager).on("activeEditorChange", function(evt, active, last) {
		closeCurrentViewEditor();
		toggleActiveLine(last, currentDocActiveLine, false);

		if (active) {
			currentDocFullPath = active.getFile().fullPath;
			removeUnusedGutterMarkers(active);
			renderBreakPoints(active);
		}
	});
});