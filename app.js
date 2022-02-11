require('dotenv').config(); // Load .env file for environment

const express = require('express');
const app = express(); // ExpressJS
const cors = require('cors'); // Cross-Origin Resource Sharing (CORS)
const http = require('http').createServer(app);
const flash = require('connect-flash'); // Session flash
const express_session = require('express-session'); // ExpressJS session
const express_socketio_session = require('express-socket.io-session'); // ExpressJs + Socket.io session
const FileStore = require('session-file-store')(express_session); // ExpressJs session with file
const moment_timezone = require('moment-timezone'); // MomentJs for time
const moment_duration = require('moment-duration-format'); // MomentJs duration package
// Initialize expressJs session
const session = express_session({
	store: new FileStore(),
	secret: 'my-secret-key',
	resave: true,
	saveUninitialized: true,
	cookie: { secure: false, maxAge: Date.now() + (30 * 86400 * 1000) }
});
const io = require('socket.io')(http, { path: '/ws' });
io.use(express_socketio_session(session, { autoSave: true })); // Initialize expressjs session with socket.io

global.visitors = new Array();
global.admins = new Array();

// Set global variable
global.DB;
global.io = io;
global.Models;
global.Libraries = require(__dirname+'/libraries'); // Load libraries
global.ViewEngine = require(__dirname+'/view-engine'); // Setup view engine
global.moment = require('moment'); // MomentJs for date and time
global.Sockets = require(__dirname+'/sockets'); // Socket.io files

/**
 * String to Boolean
 *
 * @param      {string}   str     string
 * @return     {boolean}
 */
const string_to_boolean = function(str) {
	switch(str.toLowerCase().trim()) {
		case "true": case "yes": case "1": return true;
		case "false": case "no": case "0": case null: return false;
		default: return Boolean(str);
	}
}

/**
 * Initialzie Database
 *
 * @return     {Promise}  Database object
 */
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
		const models_name = Object.keys(models); // get models name by files name

		for (var key = 0; key < models_name.length; key ++) {
			var name = models_name[key];
			var model = models[name](DataTypes); // execute model class as function

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

		connection.sync({ [process.env.DB_MODE]: string_to_boolean(process.env.DB_SYNC) }).then((conn) => {
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
			role: 'admin',
			email: 'admin@nlp-chat-bot.com',
			username: 'admin',
			password: sha1('admin').toString(),
			full_name: 'Administrator'
		});
	}
});

// ExpressJs middleware
app.use(
	session,
	flash(),
	express.json(),
	express.urlencoded({ extended: true }),
	express.static(__dirname+'/public')
);
app.set('views', __dirname+'/views'); // Initialize view files to express js
app.set('view engine', 'twig'); // Initialize view engine to twig
app.use(cors({ origin : (origin, callback) => { callback(null, true) }, credentials: true })); // Initialize HTTP CORS
app.use((req, res, next) => {
	res.locals.app = {
		name: 'Chat Bot NLP',
		vendor: 'Kesuma Dwi Ningtyas',
		version: 'v1.0.0'
	}

	// Render view file
	res.render = (file, options = {}) => {
		Object.assign(options, res.locals); // merge option variable to local variable
		const Twig = new ViewEngine.Twig(__dirname+'/views'); // assign template paths

		// Register Filter : map_merge
		Twig.addFilter('map_merge', (array_object, new_item) => {
			if (new_item.has(0)) {
				new_item.forEach((value, key, map) => {
					array_object.set(array_object.size, value);
				});
			} else {
				array_object.set(array_object.size, new_item);
			}

			return Promise.resolve(array_object);
		});

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

// ExpressJs middleware
const Middleware = {
	admin: async (req, res, next) => {
		if (req.originalUrl.match(/^\/admin(\/)?.*/)) {
			var auth_pages = /\/(sign-in|sign-up|forgot-password|recover-account|confirm-code)\/?/;
			if (typeof req.session.user_id == 'undefined') {
				if (req.originalUrl.match(auth_pages) == null) {
					req.flash('redirected', true);
					res.status(401);
					res.redirect('/admin/sign-in');
				} else {
					next();
				}
			} else {
				res.locals.user = await Models.user.findOne({
					where: {
						id: req.session.user_id
					}
				});

				if (req.originalUrl.match(auth_pages) !== null) {
					res.redirect('/admin');
				} else {
					next();
				}
			}
		} else {
			next();
		}
	},
	page: async (req, res, next) => {
		res.locals.pages = await Models.page.findAll();
		next();
	}
}

app.use(Middleware.page);

// Site routing
app.get('/', (req, res) => {
	res.render('home.twig', {
	});
})
.get('/page/:slug', async (req, res) => {
	var page = await Models.page.findOne({
		where: {
			slug: req.params.slug
		}
	});

	res.render('page.twig', {
		page: page
	});
})
.get('/about', (req, res) => {
	res.render('about.twig');
}).get('/contact', (req, res) => {
	res.render('contact.twig');
});

/**
 * Admin chat bot routing
 */
app
// dashboard
.get('/admin', Middleware.admin, (req, res) => {
	res.render('admin/home.twig', {
		active_menu: 'home'
	});
})
// sign in
.get('/admin/sign-in', Middleware.admin, (req, res) => {
	res.render('admin/sign-in.twig');
})
// sign in post data
.post('/admin/sign-in', Middleware.admin, async (req, res) => {
	var sha1 = require('crypto-js/sha1');
	var sign_in = await Models.user.findOne({
		where: {
			[DB.Op.or]: [
				{ email: req.body.identity },
				{ username: req.body.identity }
			],
			password: sha1(req.body.password).toString()
		}
	});

	if (sign_in !== null) {
		req.session.user_id = sign_in.id;
		req.flash('sign_in', true);
		res.redirect('/admin');
	} else {
		req.flash('redirected', true);
		res.status(401).redirect('/admin/sign-in');
	}
})
// sign up
.get('/admin/sign-up', Middleware.admin, (req, res) => {
	res.render('admin/sign-up.twig');
})
// sign up post data
.post('/admin/sign-up', Middleware.admin, async (req, res) => {
	var sha1 = require('crypto-js/sha1');
	var sign_up = await Models.user.create({
		email: req.body.email,
		username: req.body.username,
		password: sha1(req.body.password).toString(),
		full_name: req.body.full_name
	});

	if (sign_up) {
		req.flash('sign_up', true);
		res.redirect('/admin/sign-in');
	} else {
		req.flash('sign_up', true);
		res.status(401).redirect('/admin/sign-in');
	}
})
// forgot password
.get('/admin/forgot-password', Middleware.admin, (req, res) => {
	res.render('admin/forgot-password.twig');
})
// forgot password post data
.post('/admin/forgot-password', Middleware.admin, async (req, res) => {
	var forgot_password = await Models.user.findOne({
		where: {
			[DB.Op.or]: [
				{ email: req.body.identity },
				{ username: req.body.identity }
			]
		}
	});

	if (forgot_password) {
		req.flash('forgot_password', true);
		res.redirect('/admin');
	} else {
		req.flash('redirected', true);
		res.status(401).redirect('/admin/sign-in');
	}
})
// user profile
.get('/admin/user/:uid?', Middleware.admin, async (req, res) => {
	res.locals.user_profile = await Models.user.findOne({
		where: {
			id: (req.params.uid !== undefined)?req.params.uid:res.locals.user.id
		}
	});
	res.render('admin/profile.twig');
})

.get('/admin/page/:option?/:id?', Middleware.admin, async (req, res) => {
	var mode;
	var data = await new Promise(async (resolve, reject) => {
		if ((req.params.option == 'view' || req.params.option == undefined) && req.params.id == undefined) {
			mode = 'list';
			resolve(await Models.page.findAll());
		} else if (req.params.option == 'view' && req.params.id !== undefined) {
			mode = 'view';
			resolve(await Models.page.findOne({
				where: {
					id: req.params.id
				}
			}));
		} else if (req.params.option == 'delete' && req.params.id !== undefined) {
			var page = await Models.page.findOne({
				where: {
					id: req.params.id
				}
			});
			page.destroy();
			res.redirect('/admin/page');
		} else if (req.params.option == 'new') {
			mode = 'new';
			resolve(true);
		} else if (req.params.option == 'edit' && req.params.id !== undefined) {
			mode = 'edit';
			resolve(await Models.page.findOne({
				where: {
					id: req.params.id
				}
			}));
		} else {
			resolve(false);
		}
	});

	res.render('admin/page.twig', { data: data, mode: mode });
})
.post('/admin/page/:option?/:id?', Middleware.admin, async (req, res) => {
	if (req.params.option == undefined || req.params.option == 'add') {
		await Models.page.create({
			name: req.body.name,
			title: req.body.title,
			slug: req.body.slug,
			content: req.body.content
		});

		res.redirect('/admin/page');
	} else if (req.params.option == 'edit') {
		var page = await Models.page.findOne({
			where: {
				id: req.params.id
			}
		});

		if (page !== null) {
			await page.update({
				name: req.body.name,
				title: req.body.title,
				slug: req.body.slug,
				content: req.body.content
			});
		}

		res.redirect('/admin/page');
	}
})
.get('/admin/live_chat', Middleware.admin, (req, res) => {
	res.render('admin/live_chat.twig', {
		active_menu: 'live_chat'
	});
})

// sign out
.get('/admin/sign-out', Middleware.admin, (req, res) => {
	req.session.destroy((err) => {
		res.redirect('/admin/sign-in');
	});
});

http.listen(process.env.PORT || 8080);
