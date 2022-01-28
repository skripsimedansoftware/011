require('dotenv').config(); // Load .env file for environment

const express = require('express');
const app = express();
const cors = require('cors');
const http = require('http').createServer(app);
const flash = require('connect-flash');
const express_session = require('express-session');
const FileStore = require('session-file-store')(express_session);
const moment_timezone = require('moment-timezone');
const moment_duration = require('moment-duration-format');
const session = express_session({
	store: new FileStore(),
	secret: 'my-secret-key',
	resave: true,
	saveUninitialized: true,
	cookie: { secure: false, maxAge: Date.now() + (30 * 86400 * 1000) }
});

global.DB;
global.Models;
global.ViewEngine = require(__dirname+'/view-engine');
global.moment = require('moment');

const Initialize_Database = () => {
	return new Promise((resolve, reject) => {
		var config = require('./config/database');
		const { host, port, username, password, database, dbdriver, timezone, debugging } = config;
		const { Sequelize, Op, Model, DataTypes } = require('sequelize');
		const connection = new Sequelize.Sequelize(database, username, password, {
			host: host,
			port: (port !== 3306)?port:3306,
			dialect: dbdriver,
			logging: debugging
		});

		// load models
		const models = require(__dirname+'/models/');
		const models_name = Object.keys(models);

		for (var key = 0; key < models_name.length; key ++) {
			var name = models_name[key];
			var model = models[name](DataTypes);

			name = (model.config !== undefined && model.config.modelName !== undefined)?model.config.modelName:name;
			connection.define(name, model.fields, Object.assign({
				tableName: name,
				freezeTableName: true,
				underscored: true,
				createdAt: 'created_at',
				updatedAt: 'updated_at',
				charset: 'utf8mb4',
				collate: 'utf8mb4_unicode_ci'
			}, model.config));
		}

		for (var key = 0; key < models_name.length; key ++) {
			var name = models_name[key];
			var model = models[name](DataTypes);

			if (model.associate !== undefined && model.associate.length > 0) {
				model.associate.forEach((relation, key) => {
					// removing object keys : type & model to show associations config only
					var associate = model.associate.map((associate, k) => {
						var new_object = {}
						var object_keys  = Object.keys(associate);
						for (var i = 0; i < object_keys.length; i++) {
							if (['type', 'model'].indexOf(object_keys[i]) == -1) {
								new_object[object_keys[i]] = associate[object_keys[i]];
							}
						}

						return new_object;
					});

					connection.models[name][relation.type](connection.models[[model.associate[key].model]], associate[key]);
				});
			}
		}

		connection.sync({ [process.env.DB_MODE]: process.env.DB_SYNC }).then((conn) => {
			global.Models = Object.assign(connection.models, global.Models);
			resolve({ connection, Sequelize, Op, Model, DataTypes });
		});
	});
}

Initialize_Database().then(async init => {
	DB = init;

	var sha1 = require('crypto-js/sha1');
	var user = await Models.user.count();
	if (user < 1) {
		await Models.user.create({
			email: 'admin@nodejs-simple-app.software',
			username: 'admin',
			password: sha1('admin').toString(),
			full_name: 'Administrator'
		});
	}
});

app.use(
	session,
	flash(),
	express.json(),
	express.urlencoded({ extended: true }),
	express.static(__dirname+'/public')
);
app.set('views', __dirname+'/views');
app.set('view engine', 'twig');
app.use(cors({ origin : (origin, callback) => { callback(null, true) }, credentials: true }));
app.use((req, res, next) => {
	res.locals.app = {
		name: 'NodeJs Simple App',
		vendor: 'Medan Software',
		version: 'v1.0.0'
	}

	res.render = (file, options = {}) => {
		Object.assign(options, res.locals); // merge option variable to local variable
		const Twig = new ViewEngine.Twig(__dirname+'/views'); // assign template paths

		// render with twig
		Twig.render(file, options, (error, output) => {
			if (error) {
				res.send(output);
			} else {
				res.send(output);
			}
		});
	}

	next();
});

app.get('/', (req, res) => {
	res.render('home.twig', {
		name: 'Developer'
	});
}).get('/about', (req, res) => {
	res.render('about.twig');
}).get('/contact', (req, res) => {
	res.render('contact.twig');
});

http.listen(process.env.PORT || 8080);
