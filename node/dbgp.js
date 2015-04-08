/**
 * Package: https://github.com/ajaxorg/lib-phpdebug
 *
 * License: MIT
 *
 * Copyright(c) 2011 Ajax.org B.V. <info AT ajax DOT org>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * Author: Christoph Dorn <christoph@christophdorn.com> (http://www.christophdorn.com/)
 *
 * Purpose of this module:
 *
 *   A JavaScript implementation of the [DBGP Protocol](http://www.xdebug.org/docs-dbgp.php)
 *   used by [Xdebug](http://www.xdebug.org/).
 *
 */

var PacketParser = exports.PacketParser = function() {
	this.listeners = {};
	this.buffer = "";
};

PacketParser.prototype.on = function(name, callback) {
	if (!this.listeners[name]) {
		this.listeners[name] = [];
	}

	this.listeners[name].push(callback);
};

PacketParser.prototype.emit = function(name, args) {
	if (!this.listeners[name]) {
		return;
	}

	args = args || {};
	for (var i = 0, ic = this.listeners[name].length ; i < ic; i++) {
		this.listeners[name][i].call(null, args);
	}
};

PacketParser.prototype.parseChunk = function(chunk) {
	var self = this;

	// 6.4 debugger engine to IDE communications
	// @see http://www.xdebug.org/docs-dbgp.php#id31

	// If chunk does not end in delimiter we got a partial chunk and need to buffer it.
	if (this.buffer !== "") {
		chunk = this.buffer + chunk;
		this.buffer = "";
	}

	if (!/\u0000$/.test(chunk)) {
		this.buffer = chunk;
		// TODO: Parse as much of the buffer as we can right away
		return;
	}

	var parts = chunk.split(/\u0000/g), lastPart;

	if ((lastPart = parts.pop()) !== "") {
		throw new Error("Chunk does not end in `\u0000`! Found instead: " + lastPart);
	} if ((parts.length) % 2) {
		throw new Error("Invalid chunk format. Expecting `length[NULL]data[NULL]...`. Got: " + chunk);
	}

	var length, data;

	while (parts.length > 0) {
		length = parts.shift();
		data = parts.shift();

		if (length != data.length) {
			throw new Error(
				"Announced packet length '" + length +
				"' does not match actual data length '" + data.length + "' for data '" + data + "'!"
			);
		}

		// Check if we need to convert the XML message to a JSON one
		if (/\s*<\?xml\s/.test(data)) {
			self.emit("packet", data);
		} else {
			throw new Error("Cannot parse chunk. Chunk not in XML format!");
		}
	}
};