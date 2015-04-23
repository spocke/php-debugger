/**
 * Main model for the brackets plugin.
 */
define(function(require, exports, module) {
	var ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
		panel = require('./lib/panel'),
		console = require('./lib/console'),
		xdebug = require('./lib/xdebug'),
		commands = require('./lib/commands'),
		tree = require('./lib/tree'),
		editor = require('./lib/editor'),
		Menus = brackets.getModule("command/Menus"),
		AppInit = brackets.getModule("utils/AppInit"),
		CommandManager = brackets.getModule("command/CommandManager"),
		NodeDomain = brackets.getModule("utils/NodeDomain"),
		EditorManager = brackets.getModule("editor/EditorManager"),
		PreferencesManager = brackets.getModule("preferences/PreferencesManager");

	var moduleName = "php-debugger";
	var nodeDomain = new NodeDomain(moduleName, ExtensionUtils.getModulePath(module, "./node/main"));
	var TOGGLE_PANEL_CMD = moduleName + ".togglePanel";
	var TOGGLE_BREAKPOINT_CMD = moduleName + ".toggleBreakPoint";

	CommandManager.register("PHP Debugger", TOGGLE_PANEL_CMD, commands.toggle.bind(commands));
	CommandManager.register("Toggle Breakpoint", TOGGLE_BREAKPOINT_CMD, function() {
		var editor = EditorManager.getCurrentFullEditor();
		var selection = editor.getSelection();

		commands.toggleBreakPoint({
			line: selection.start.line
		});
	});

	var menu = Menus.getMenu(Menus.AppMenuBar.VIEW_MENU);
	menu.addMenuItem(TOGGLE_PANEL_CMD);

	var stateManager = PreferencesManager.stateManager.getPrefixedSystem(moduleName);

	ExtensionUtils.loadStyleSheet(module, "main.less");

	var prefs = PreferencesManager.getExtensionPrefs(moduleName);

	var contextMenu = Menus.getContextMenu(Menus.ContextMenuIds.EDITOR_MENU);
	contextMenu.addMenuItem(TOGGLE_BREAKPOINT_CMD);

	function initKeyboardOverride() {
		// Override keys only when the debugger is connected
		$(document).on('keydown keypress', function(e) {
			if (!xdebug.isConnected()) {
				return;
			}

			switch (e.keyCode) {
				case 121: // F11
					e.preventDefault();
					commands.step_over();
				break;

				case 122: // F12
					e.preventDefault();
					commands.step_into();
				break;
			}
		});
	}

	function initSideBar() {
		var $icon = $('<a href="#" id="phpdebugger-sidebar-icon" title="PHP Debugger"></a>');

		$icon.appendTo($("#main-toolbar .buttons"));

		$icon.on('click', function() {
			commands.toggle();
		});
	}

	function initModules() {
		panel.init();
		console.init({
			debug: prefs.get('debug')
		});
		xdebug.init({
			nodeDomain: nodeDomain,
			port: prefs.get('port'),
			idekey: prefs.get('idekey'),
			debug: prefs.get('debug')
		});
		commands.init();
		tree.init();
		editor.init();
	}

	function bindEvents() {
		$(editor).on('change', function() {
			commands.stop();
		});

		$(editor).on('breakPointAdded', function(e, breakPoint) {
			if (xdebug.isConnected()) {
				return xdebug.execute("breakpoint_set", {
					t: "line",
					n: breakPoint.line + 1,
					f: breakPoint.fullPath
				}).done(function($elm) {
					breakPoint.serverId = $elm.attr('id');
				});
			}
		});

		$(editor).on('breakPointRemoved', function(e, breakPoint) {
			if (xdebug.isConnected()) {
				return xdebug.execute("breakpoint_remove", {
					d: breakPoint.serverId
				});
			}
		});

		$(panel).on('cmd', function(e, data) {
			var cmdFunc = commands[data.cmd];

			if (cmdFunc) {
				cmdFunc(data.args, data.elm);
			} else {
				console.log("Error: " + data.cmd + " not found.");
			}
		});

		$(panel).on('stateChange', function(e, state) {
			stateManager.set('panelVisibility', state);
			CommandManager.get(TOGGLE_PANEL_CMD).setChecked(state);
			CommandManager.get(TOGGLE_BREAKPOINT_CMD).setEnabled(state);
			$('#phpdebugger-sidebar-icon').toggleClass("phpdebugger-sidebar-icon-active", state);
		});
	}

	function handleViewState() {
		var visibleState = stateManager.get('panelVisibility');
		if (visibleState || typeof visibleState == "undefined") {
			commands.open();
		}
	}

	AppInit.appReady(function() {
		initKeyboardOverride();
		initModules();
		bindEvents();
		initSideBar();
		handleViewState();
	});
});