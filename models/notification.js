module.exports = function(DataTypes) {
	return {
		fields: {
			id: {
				type: DataTypes.BIGINT.UNSIGNED,
				primaryKey: true,
				autoIncrement: true
			},
			content: {
				type: DataTypes.STRING,
				allowNull: false
			},
			link: {
				type: DataTypes.STRING,
				allowNull: false
			},
			status: {
				type: DataTypes.ENUM('opened', 'pending'),
				allowNull: false
			}
		},
		associate: [],
		config: {
			paranoid: true
		}
	}
}
