module.exports = function(DataTypes) {
	return {
		connections: [process.env.DB_ACTIVE],
		fields: {
			id: {
				type: DataTypes.BIGINT.UNSIGNED,
				primaryKey: true,
				autoIncrement: true
			},
			type: {
				type: DataTypes.STRING,
				allowNull: false
			},
			title: {
				type: DataTypes.STRING,
				allowNull: true
			}
		},
		associate: [
			{ type: 'hasMany', model: 'chat_participant', foreignKey: 'chat_room_id' }, // chat_room.id has many chat_participant.chat_room_id
			{ type: 'hasMany', model: 'chat_message', foreignKey: 'chat_room_id' } // chat_room.id has many chat_message.id
		]
	}
}
