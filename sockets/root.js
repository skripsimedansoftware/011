
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

			var chat = await Models.chat_room.findOne({
				where: {
					id: data.room
				}
			});

			if (data.from == 'guest') {

				if (admins.length < 1) {
					if (chat !== null) {
						var Naive_Bayes = require('wink-naive-bayes-text-classifier')();
						var NLP = require('wink-nlp-utils');
						Naive_Bayes.defineConfig({ considerOnlyPresence: true, smoothingFactor: 0.5 });
						Naive_Bayes.definePrepTasks([
							// Simple tokenizer
							NLP.string.tokenize0,

							// Common Stop Words Remover
							NLP.tokens.removeWords,

							// Stemmer to obtain base word
							NLP.tokens.stem
						]);

						var data_training = await Models.training_question.findAll();
						data_training.forEach((el, index) => {
							Naive_Bayes.learn(el.text, el.category);
							if ((index+1) == data_training.length) {
								Naive_Bayes.consolidate();
							}
						});

						var predict = Naive_Bayes.predict(data.text);
						var answer = await Models.training_answer.findAll({
							where: {
								category: predict
							}
						});

						var chat_participant = await Models.chat_participant.findOne({ where: { chat_room_id: chat.get('id'), user_id: 2 }});
						if (chat_participant == null) {
							chat_participant = await Models.chat_participant.create({ chat_room_id: chat.get('id'), user_id: 2 });
						}

						var array_random = function(array) {
							var random = Math.floor(Math.random() * array.length);
							return array[random];
						}

						if (answer.length < 1) {
							answer = 'Maaf, saya tidak mengerti yang anda maksud';
							answer += '<br><br><small>Dibalas oleh bot</small>';
						} else {
							answer = array_random(answer);
							answer = answer.get('text');
							answer += '<br><br><small>Dibalas oleh bot</small>';
						}

						var chat_message = await Models.chat_message.create({
							chat_room_id: chat.get('id'),
							participant_id: chat_participant.get('id'),
							sender: 'user',
							text: answer
						});

						var bot = await Models.chat_participant.findOne({
							include: Models.user,
							where: {
								chat_room_id: chat.get('id'),
								user_id: 2
							}
						});

						io.of('/').to(parseInt(chat.get('id'))).emit('chat-room-message', {
							room: chat.get('id'),
							from: 'user',
							name: bot.user.get('full_name'),
							text: answer,
							time: moment(chat_message.get('created_at')).format('DD MMM YYYY HH:mm a')
						});
					}
				}
			}

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
