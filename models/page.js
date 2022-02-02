module.exports = function(DataTypes) {
	return {
		fields: {
			id: {
				type: DataTypes.BIGINT.UNSIGNED,
				primaryKey: true,
				autoIncrement: true
			},
			name: {
				type: DataTypes.STRING(20),
				allowNull: false
			},
			title: {
				type: DataTypes.STRING(20),
				allowNull: false
			},
			slug: {
				type: DataTypes.STRING(120),
				allowNull: true
			},
			content: {
				type: DataTypes.TEXT,
				allowNull: true
			}
		},
		associate: []
	}
}
