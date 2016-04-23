/**
 * Module that handles xdebug connections.
 */

var EventEmitter = require("events").EventEmitter,
	net = require("net"),
	PacketParser = require("./dbgp").PacketParser;

var sessionCount = 0;

function Session(server, socket) {
	var self = this, packetParser;

	this.id = "sid-" + (sessionCount++);
	this.status = "starting";

	packetParser = new PacketParser();

	packetParser.on("packet", function(packet) {
		server.emit("data", self, packet);
	});

	socket.on("data", function(data) {
		try {
			packetParser.parseChunk(data.toString());
		} catch (ex) {
			console.log(ex.message);
		}
	});

	socket.on("end", function() {
		socket.destroy();
		socket = null;
		server.emit("disconnect", self);
	});

	this.send = function(data, callback) {
		if (!socket) {
			callback({
				message: "Socket closed.",
				code: -2
			}, null);

			return;
		}

		socket.write(data + "\u0000");
		callback(null, null);
	};

	this.close = function() {
		if (socket) {
			socket.destroy();
			socket = null;
			server.emit("disconnect", self);
		}
	};
}

function Server() {
	var self = this, sessions = {}, server;

	this.startServer = function(args, callback) {
		self.disconnect();

		if (!server) {
			server = net.createServer(function(socket) {
				var session = new Session(self, socket);

				sessions[session.id] = session;

				self.emit("connect", session);
			});

			server.listen(args[0]);
		}

		callback(null, null);
	};

	this.stopServer = function(args, callback) {
		callback(null, null);

		if (server) {
			server.close(function() {
				callback(null, null);
			});

			server = null;
		}
	};

	this.disconnect = function(args, callback) {
		var id;

		for (id in sessions) {
			sessions[id].close();
		}

		sessions = {};

		if (callback) {
			callback(null, null);
		}
	};

	this.send = function(args, callback) {
		var session = sessions[args[0]];

		if (session) {
			session.send(args[1], function(error, result) {
				callback(error, result);
			});
		} else {
			callback({
				message: "Session not found",
				code: -2
			}, null);
		}
	};
}

Server.prototype = new EventEmitter();

module.exports = new Server();
