module.exports = function(DataTypes) {
	return {
		fields: {
			id: {
				type: DataTypes.BIGINT.UNSIGNED,
				primaryKey: true,
				autoIncrement: true
			},
			name: {
				type: DataTypes.STRING(80),
				allowNull: false
			},
			email: {
				type: DataTypes.STRING(80),
				allowNull: true
			},
			whatsapp: {
				type: DataTypes.STRING(20),
				allowNull: true
			}
		},
		associate: []
	}
}
