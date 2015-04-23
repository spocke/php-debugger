/**
 * Module for creating tree structures in the UI.
 */
define(function(require, exports) {
	function TreeNode(opts, children) {
		this.children = children;

		this.renderTo = function(node) {
			var $div = $('<div class="tree-view tree-view-collapsed">'),
				$title = $('<div class="tree-text">').text(opts.text);

			if (opts.cmd) {
				$div.attr('data-phpdebugger-cmd', opts.cmd);
				if (opts.args) {
					$div.attr('data-phpdebugger-args', JSON.stringify(opts.args));
				}
			}

			if (children || opts.hasChildren) {
				if (!opts.lockedRoot) {
					var $arrow = $('<div class="tree-view-arrow">').text('▾');
					$arrow.prependTo($title);
				} else {
					$div.removeClass("tree-view-collapsed");
				}

				$div.addClass('tree-has-children');
			}

			if (opts.className) {
				$div.addClass(opts.className);
			}

			$div.append($title);
			TreeNode.renderChildrenTo(children, $div);
			$div.appendTo(node);
		};

		this.append = function(node) {
			if (!children) {
				children = [];
			}

			children.push(node);

			this.children = children;
		};
	}

	TreeNode.renderChildrenTo = function(children, $div) {
		if (children) {
			var $children = $('<div class="tree-view-children">');

			children.forEach(function(node) {
				node.renderTo($children[0]);
			});

			$children.appendTo($div);
		}
	};

	exports.TreeNode = TreeNode;

	exports.init = function() {
		$('#phpdebugger-panel').on('click', '.tree-view', function(e) {
			e.stopPropagation();
			$(this).toggleClass('tree-view-collapsed');
		});
	};

	exports.fromProperty = function(property, level) {
		var treeNode, text, typeText, cmd, args, lockedRoot, hasChildren = false;

		text = property.name;

		if (property.type == "array") {
			if (property.recursive) {
				typeText = "Array[...]";
			} else {
				typeText = "Array[" + property.numChildren + "]";
			}

			hasChildren = property.numChildren > 0 || property.recursive;
		} else if (property.type == "object") {
			typeText = property.className;
			hasChildren = property.numChildren > 0 || property.recursive;
		} else {
			typeText = property.value;
		}

		if (text) {
			text += ": " + typeText;
		} else {
			text = typeText;
		}

		if (property.hasChildren && !property.children) {
			if (level === -1) {
				hasChildren = property.hasChildren = false;
			} else {
				cmd = "expandProperty";

				args = {
					fullName: property.fullName,
					level: level
				};
			}
		}

		if (property.type == "context") {
			lockedRoot = true;
			text = "";
		}

		treeNode = new TreeNode({
			text: text,
			hasChildren: hasChildren,
			lockedRoot: lockedRoot,
			cmd: cmd,
			args: args
		});

		if (property.hasChildren) {
			if (property.children) {
				property.children.forEach(function(property) {
					treeNode.append(exports.fromProperty(property, level));
				});
			}
		}

		return treeNode;
	};

	exports.renderJsonTo = function(json, targetNode) {
		function walk(json, key, tree) {
			var node, text = "";

			if (key !== null) {
				text = key + ": ";
			}

			if (Array.isArray(json)) {
				text += "Array[" + json.length + "]";
				node = new TreeNode({text: text});

				if (tree) {
					tree.append(node);
				}

				for (var i = 0; i < json.length; i++) {
					walk(json[i], i, node);
				}
			} else if (typeof json == "object") {
				text += "Object";
				node = new TreeNode({text: text});

				if (tree) {
					tree.append(node);
				}

				for (var name in json) {
					walk(json[key], name, node);
				}
			} else {
				text += json.toString();
				node = new TreeNode({text: text});

				if (tree) {
					tree.append(node);
				}
			}

			return node;
		}

		walk(json, null).renderTo(targetNode);
	};
});