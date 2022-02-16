module.exports = function(DataTypes) {
	return {
		connections: [process.env.DB_ACTIVE],
		fields: {
			id: {
				type: DataTypes.BIGINT.UNSIGNED,
				primaryKey: true,
				autoIncrement: true
			},
			pending_answer: {
				type: DataTypes.BOOLEAN,
				allowNull: true
			},
			status: {
				type: DataTypes.ENUM('opened', 'in-progress', 'closed'),
				allowNull: false
			}
		},
		associate: [
			{ type: 'hasOne', model: 'chat_participant', foreignKey: 'chat_room_id' }, // chat_room.id has many chat_participant.chat_room_id
			{ type: 'hasMany', model: 'chat_message', foreignKey: 'chat_room_id' } // chat_room.id has many chat_message.id
		]
	}
}
