/**
 * Module with various utility functions.
 */
define(function(require, exports) {
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

	function toEditorPath(fullPath) {
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

	function toXdebugPath(filePath) {
		filePath = toEditorPath(filePath);

		// Add slash before drive letter
		filePath = filePath.replace(/^[a-z0-9]:/i, function(m) {
			return "/" + m;
		});

		return "file://" + filePath;
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

	$.extend(exports, {
		propertyToJson: propertyToJson,
		toEditorPath: toEditorPath,
		toXdebugPath: toXdebugPath,
		attachCommand: attachCommand,
		comparePaths: comparePaths,
		shorten: shorten
	});
});
