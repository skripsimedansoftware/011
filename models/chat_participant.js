module.exports = function(DataTypes) {
	return {
		fields: {
			id: {
				type: DataTypes.BIGINT.UNSIGNED,
				primaryKey: true,
				autoIncrement: true
			},
			chat_room_id: {
				type: DataTypes.BIGINT.UNSIGNED,
				allowNull: false
			},
			user_id: {
				type: DataTypes.BIGINT.UNSIGNED,
				allowNull: true
			},
			guest_id: {
				type: DataTypes.BIGINT.UNSIGNED,
				allowNull: true
			}
		},
		associate: [
			{ type: 'belongsTo', model: 'chat_room', foreignKey: 'chat_room_id', targetKey: 'id' }, // chat_participant.chat_room_id reference to chat_room.id
			{ type: 'belongsTo', model: 'user', foreignKey: 'user_id', targetKey: 'id' }, // chat_participant.user_id reference to user.id
			{ type: 'belongsTo', model: 'guest', foreignKey: 'guest_id', targetKey: 'id' }, // chat_participant.guest_id reference to guest.id
			{ type: 'belongsTo', model: 'chat_message', foreignKey: 'chat_room_id', targetKey: 'chat_room_id' },
		]
	}
}
