module.exports = function(DataTypes) {
	return {
		fields: {
			id: {
				type: DataTypes.BIGINT.UNSIGNED,
				primaryKey: true,
				autoIncrement: true
			},
			role: {
				type: DataTypes.ENUM('admin', 'user'),
				allowNull: false
			},
			id_card: {
				type: DataTypes.STRING(40),
				allowNull: true
			},
			email: {
				type: DataTypes.STRING(40),
				allowNull: true
			},
			username: {
				type: DataTypes.STRING(16),
				allowNull: true
			},
			password: {
				type: DataTypes.STRING(40),
				allowNull: true
			},
			full_name: {
				type: DataTypes.STRING(80),
				allowNull: false
			}
		},
		associate: [],
		config: {
			paranoid: true
		}
	}
}
