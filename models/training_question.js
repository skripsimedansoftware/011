module.exports = function(DataTypes) {
	return {
		connections: [process.env.DB_ACTIVE],
		fields: {
			id: {
				type: DataTypes.BIGINT.UNSIGNED,
				primaryKey: true,
				autoIncrement: true
			},
			category: {
				type: DataTypes.STRING,
				allowNull: false
			},
			text: {
				type: DataTypes.STRING,
				allowNull: false
			}
		},
		associate: []
	}
}
