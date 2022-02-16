io.of('/').on('connection', (socket) => {
	if (visitors.indexOf(socket.id) == -1) { // if data not available in global variable
		visitors.push(socket.id) // add to global variable
		socket.to('admin').emit('visitors', visitors.length); // broadcast for update information
	}

	/**
	 * Assign as admin
	 */
	socket.on('assign_admin', (callback) => {
		socket.join('admin'); // Join to admin room
		if (visitors.indexOf(socket.id) !== -1) { // if available in global variable
			visitors.splice(visitors.indexOf(socket.id), 1); // remove grom global variable, because this assign as admin
			callback(visitors.length); // callback for update information
			socket.to('admin').emit('visitors', visitors.length); // broadcast for update information
		}

		if (admins.indexOf(socket.id) == -1) { // if data not available in global variable
			admins.push(socket.id) // add to global variable
			socket.to('visitor').emit('admin', admins.length); // broadcast for update information
		}
	});

	/**
	 * Customer chat
	 */
	socket.on('customer-chat', (data) => {
		socket.to('admin').emit('notification', {
			type: 'notification',
			code: 'new-chat',
			data: data
		});
	});

	/**
	 * Chat room message
	 */
	socket.on('chat-room-message', (data) => {
		socket.to(parseInt(data.room)).emit('chat-message', data.message);
	});

	/**
	 * Chat room end session
	 */
	socket.on('chat-room-end', chat_room => {
		socket.to(parseInt(chat_room)).emit('chat-room-end');
	});

	/**
	 * Disconnected user
	 */
	socket.on('disconnect', () => {
		// If disconnected user is visitor?
		if (visitors.indexOf(socket.id) !== -1) { // if available in global variable
			visitors.splice(visitors.indexOf(socket.id), 1); // remove data from global variable
			socket.to('admin').emit('visitors', visitors.length); // broadcast for update information
		}

		// If disconnected user is admin?
		if (admins.indexOf(socket.id) !== -1) { // if available in global variable
			admins.splice(admins.indexOf(socket.id), 1); // remove data from global variable
			socket.to('visitor').emit('admin', admins.length); // broadcast for update information
		}
	});
});

module.exports = io;
