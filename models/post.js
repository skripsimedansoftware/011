module.exports = function(DataTypes) {
	return {
		fields: {
			id: {
				type: DataTypes.BIGINT.UNSIGNED,
				primaryKey: true,
				autoIncrement: true
			},
			type: {
				type: DataTypes.ENUM('page', 'post'),
				allowNull: false
			},
			title: {
				type: DataTypes.STRING(200),
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
