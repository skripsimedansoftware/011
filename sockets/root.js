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

	socket.on('chat-room-join', (room) => {
		socket.join(parseInt(room));
	});

	/**
	 * Chat room message
	 */
	socket.on('chat-room-message', async (data) => {
		if (data.from == 'guest') {
			var participant = await Models.chat_participant.findOne({
				include: Models.guest,
				where: {
					chat_room_id: data.room,
					guest_id: data.sender
				}
			});
		} else {
			var participant = await Models.chat_participant.findOne({
				include: Models.user,
				where: {
					chat_room_id: data.room,
					user_id: data.sender
				}
			});
		}

		if (participant !== null) {
			var chat_message = await Models.chat_message.create({
				chat_room_id: data.room,
				participant_id: participant.get('id'),
				sender: data.from,
				text: data.text
			});

			socket.to(parseInt(data.room)).emit('chat-room-message', {
				room: data.room,
				from: data.from,
				name: (data.from == 'guest')?participant.guest.get('name'):participant.user.get('full_name'),
				text: data.text,
				time: moment(chat_message.get('created_at')).format('DD MMM YYYY HH:mm a')
			});
		}
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
