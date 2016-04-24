/**
 * Module with various utility functions.
 */
define(function(require, exports) {
	var ProjectManager = brackets.getModule("project/ProjectManager");
	var console = require("./console");

	var pathMap = {};
	var projectRoot = null;
	var remoteProjectRoot = null;

	function setProjectRoot() {
		var currentProjectRoot = ProjectManager.getProjectRoot().fullPath;

		if (currentProjectRoot !== projectRoot) {
			projectRoot = currentProjectRoot;

			if (pathMap[projectRoot]) {
				remoteProjectRoot = pathMap[projectRoot];
				console.log("Using path map: " + projectRoot + ":" + remoteProjectRoot);
				return;
			} else if (projectRoot) {
				console.log("No path map found for: " + projectRoot);
			} else {
				console.log("Could not determine project root");
			}
			remoteProjectRoot = null;
		}
	}

	function propertyToJson($elm) {
		function populateValue(property, $elm) {
			switch (property.type) {
				case "null":
					property.value = null;
					break;

				case "string":
					property.value = atob($elm.text());
					break;

				case "bool":
					property.value = $elm.text() === "1";
					break;

				case "int":
				case "float":
					property.value = parseFloat($elm.text(), 10);
					break;
			}
		}

		function walk($elm) {
			var property = {};

			if ($elm[0].nodeName == "property") {
				property.name = $elm.attr("name");
				property.fullName = $elm.attr("fullname");
				property.type = $elm.attr("type");
				property.hasChildren = $elm.attr("children") === "1";
				property.numChildren = parseInt($elm.attr("numchildren"), 10);
				property.recursive = $elm.attr("recursive") === "1";

				if (property.type == "object") {
					property.className = $elm.attr("classname");
				}

				populateValue(property, $elm);
			}

			var $childProperties = $elm.children().filter("property");
			if ($childProperties.length > 0) {
				property.hasChildren = true;
				property.children = [];

				$childProperties.each(function() {
					property.children.push(walk($(this)));
				});
			}

			return property;
		}

		return walk($elm);
	}

	function normalizePath(fullPath) {
		// Decode URI
		fullPath = decodeURI(fullPath);
		
		// Remove file:// prefix
		if (fullPath.indexOf("://") != -1) {
			fullPath = fullPath.replace("file:///", "/");

			// Convert /D:/path to D:/Path
			if (fullPath.indexOf("/") === 0 && fullPath.indexOf(":") > 0) {
				fullPath = fullPath.substr(1);
			}
		}

		// Normalize drive letter to uppercase case
		fullPath = fullPath.replace(/^[a-z0-9]:/i, function(m) {
			return m.toUpperCase();
		});

		return fullPath;
	}

	function toEditorPath(fullPath) {
		fullPath = normalizePath(fullPath);

		// Map remote project path to local
		if (remoteProjectRoot) {
			var pathReplace = new RegExp('^' + remoteProjectRoot);
			fullPath = fullPath.replace(pathReplace, projectRoot);
		}

		return fullPath;
	}

	function toXdebugPath(filePath) {
		filePath = normalizePath(filePath);

		// Add slash before drive letter
		filePath = filePath.replace(/^[a-z0-9]:/i, function(m) {
			return "/" + m;
		});

		// Map local project path to remote
		if (remoteProjectRoot) {
			var pathReplace = new RegExp('^' + projectRoot);
			filePath = filePath.replace(pathReplace, remoteProjectRoot);
		}

		return "file://" + filePath;
	}

	function canOpenRemotePath(fullPath) {
		var match = new RegExp('^' + projectRoot);
		return match.test(toEditorPath(fullPath));
	}

	function attachCommand($elm, cmd, args) {
		$($elm).attr("data-phpdebugger-cmd", cmd);
		if (args) {
			$($elm).attr("data-phpdebugger-args", JSON.stringify(args));
		}
	}

	function comparePaths(path1, path2) {
		return toEditorPath(path1) === toEditorPath(path2);
	}

	function shorten(str, maxlen) {
		maxlen = maxlen || 64;

		if (str.length <= maxlen) {
			return str;
		}

		var charsToShow = maxlen - 3,
		frontChars = Math.ceil(charsToShow / 2),
		backChars = Math.floor(charsToShow / 2);

		return str.substr(0, frontChars) + "..." + str.substr(str.length - backChars);
	}

	function init(opts) {
		// Make sure trailing slashes are present on paths.
		if (typeof opts.pathMap === "object") {
			pathMap = {};
			Object.keys(opts.pathMap).forEach(function (key) {
				pathMap[key.replace(/\/+$/, '') + "/"] = opts.pathMap[key].replace(/\/+$/, '') + "/";
			});
		}

		// Update projectRoot if open project changes.
		$(ProjectManager).on("projectOpen", setProjectRoot);
	}

	$.extend(exports, {
		init: init,
		setProjectRoot: setProjectRoot,
		propertyToJson: propertyToJson,
		toEditorPath: toEditorPath,
		toXdebugPath: toXdebugPath,
		canOpenRemotePath: canOpenRemotePath,
		attachCommand: attachCommand,
		comparePaths: comparePaths,
		shorten: shorten
	});
});
