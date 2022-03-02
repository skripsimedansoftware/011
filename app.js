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
	secret: 'MedanSoftware',
	resave: false,
	saveUninitialized: true,
	// cookie: { secure: false, maxAge: Date.now() + (30 * 86400 * 1000) }
});
const io = require('socket.io')(http, { path: '/ws' });
io.use(express_socketio_session(session, { autoSave: true })); // Initialize expressjs session with socket.io

global.trained = new Array();
global.visitors = new Array();
global.admins = new Array();

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
			email: 'admin@nlp-naive-bayes.com',
			username: 'admin',
			password: sha1('admin').toString(),
			full_name: 'Administrator'
		});

		await Models.user.create({
			role: 'admin',
			email: 'bot@nlp-naive-bayes.com',
			username: 'bot',
			password: sha1('bot').toString(),
			full_name: 'Bot'
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
		name: 'Kelurahan Medan Tenggara',
		vendor: 'Kesuma Dwi Ningtyas', // 0851-5603-3913
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
		res.locals.uri_paths = req.originalUrl.split('/');
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
	notification: async (req, res, next) => {
		res.locals.notifications = await Models.notification.findAll({
			where: {
				status: 'pending'
			}
		});

		next();
	},
	page: async (req, res, next) => {
		res.locals.pages = await Models.post.findAll({
			where: {
				type: 'page'
			}
		});
		next();
	},
	chats: async (req, res, next) => {
		res.locals.chats = await Models.chat_room.findAll({
			include: [
				{
					model: Models.chat_participant,
					include: [Models.guest, Models.user]
				},
				{
					model: Models.chat_message,
					include: [
						{
							model: Models.chat_participant,
							include: [Models.guest, Models.user]
						}
					]
				}
			],
			where: { status: 'in-progress' }
		});
		next();
	},
	chat: async (req, res, next) => {
		if (req.session.chat !== undefined) {
			res.locals.chat = await Models.chat_room.findOne({
				include: {
					model: Models.chat_message,
					include: [
						{
							model: Models.chat_participant,
							include: [Models.guest, Models.user]
						}
					]
				},
				where: { id: req.session.chat }
			});

		}

		next();
	}
}

app.use(Middleware.page);

/**
 * Site routing
 */
app.get('/', Middleware.chat, (req, res) => {
	res.render('home.twig', {
		name: 'Developer'
	});
})
.get('/post/:slug?', Middleware.chat, async (req, res) => {
	if (req.params.slug == undefined) {
		var post = await Models.post.findAll({
			where: {
				type: 'post'
			}
		});
	} else {
		var post = await Models.post.findOne({
			where: {
				slug: req.params.slug
			}
		});
	}

	res.render('post.twig', {
		post: post
	});
})
.get('/page/:slug?', Middleware.chat, async (req, res) => {
	if (req.params.slug == undefined) {
		var page = await Models.post.findAll({
			where: {
				type: 'page'
			}
		});
	} else {
		var page = await Models.post.findOne({
			where: {
				slug: req.params.slug
			}
		});
	}

	res.render('page.twig', {
		page: page
	});
})
.get('/chat_bot', async (req, res) => {
	res.json({ status: 'success' });
})
.post('/chat_bot/:option?/:id?', async (req, res) => {
	if (req.params.option == 'start') {
		if (req.session.chat == undefined) {
			var chat_room = await Models.chat_room.create({ status: 'opened' });
			var guest = await Models.guest.create({
				name: (req.body.name !== undefined)?req.body.name:null,
				email: (req.body.email !== undefined)?req.body.email:null,
				phone: (req.body.phone !== undefined)?req.body.phone:null,
				whatsapp: (req.body.whatsapp !== undefined)?req.body.whatsapp:null,
			});
			var participant = await Models.chat_participant.create({ chat_room_id: chat_room.get('id'), guest_id: guest.get('id') });
			var notification = await Models.notification.create({
				content: guest.get('name')+' memulai obrolan baru',
				link: '/admin/live_chat/'+chat_room.get('id'),
				status: 'pending'
			});

			notification.update({
				link: notification.get('link')+'?notification='+notification.get('id')
			});

			io.of('/').to('admin').emit('new_notification', notification);

			req.session.chat = chat_room.get('id');
			req.session.guest = guest.get('id');

			res.json({ status: 'success', room: chat_room.get('id'), guest: req.session.guest });
		} else {
			res.json({ status: 'success', room: req.session.chat, guest: req.session.guest });
		}
	} else if (req.params.option == 'status') {
		res.json({ status: 'success', room: (req.session.chat !== undefined)?req.session.chat:'none', guest: req.session.guest });
	} else if (req.params.option == 'close') {
		var chat = await Models.chat_room.findOne({
			where: {
				id: req.params.id
			}
		});

		chat.update({ status: 'closed' });
		delete req.session.chat;
		res.json({ status: 'success' });
	}
});

/**
 * Admin chat bot routing
 */
app
/**
 * Dashboard
 */
.get('/admin', Middleware.admin, Middleware.notification, Middleware.chats, async (req, res) => {
	res.render('admin/home.twig', {
		widget: {
			chat: {
				all: await Models.chat_room.count(),
				in_progress: await Models.chat_room.count({ where: { status: 'in-progress' } }),
				closed: await Models.chat_room.count({ where: { status: 'closed' } })
			},
			data_training: {
				question: await Models.training_question.count(),
				answer: await Models.training_answer.count()
			},
			page: await Models.post.count()
		},
		active_menu: 'home'
	});
})

/**
 * Sign in
 */
.get('/admin/sign-in', Middleware.admin, Middleware.notification, Middleware.chats, (req, res) => {
	res.render('admin/sign-in.twig');
})
.post('/admin/sign-in', Middleware.admin, Middleware.notification, Middleware.chats, async (req, res) => {
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

/**
 * Sign Up
 */
.get('/admin/sign-up', Middleware.admin, Middleware.notification, Middleware.chats, (req, res) => {
	res.render('admin/sign-up.twig');
})
.post('/admin/sign-up', Middleware.admin, Middleware.notification, Middleware.chats, async (req, res) => {
	var sha1 = require('crypto-js/sha1');
	var sign_up = await Models.user.create({
		email: req.body.email,
		username: req.body.username,
		password: sha1(req.body.password).toString(),
		full_name: req.body.full_name
	});

	req.flash('sign_up', true);
	if (sign_up) {
		res.redirect('/admin/sign-in');
	} else {
		res.status(401).redirect('/admin/sign-in');
	}
})

/**
 * Forgot Password
 */
.get('/admin/forgot-password', Middleware.admin, Middleware.notification, Middleware.chats, (req, res) => {
	res.render('admin/forgot-password.twig');
})
.post('/admin/forgot-password', Middleware.admin, Middleware.notification, Middleware.chats, async (req, res) => {
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

/**
 * User profile
 */
.get('/admin/user/:uid?', Middleware.admin, Middleware.notification, Middleware.chats, async (req, res) => {
	res.locals.user_profile = await Models.user.findOne({
		where: {
			id: (req.params.uid !== undefined)?req.params.uid:res.locals.user.id
		}
	});
	res.render('admin/profile.twig');
})

/**
 * Page module
 */
.get('/admin/post/:option?/:id?', Middleware.admin, Middleware.notification, Middleware.chats, async (req, res) => {
	var mode;
	var data_id = req.params.id;
	var data = await new Promise(async (resolve, reject) => {
		if ((req.params.option == 'view' || req.params.option == undefined) && req.params.id == undefined) {
			mode = 'list';
			resolve(await Models.post.findAll());
		} else if (req.params.option == 'view' && req.params.id !== undefined) {
			mode = 'view';
			resolve(await Models.post.findOne({
				where: {
					id: req.params.id
				}
			}));
		} else if (req.params.option == 'delete' && req.params.id !== undefined) {
			var post = await Models.post.findOne({
				where: {
					id: req.params.id
				}
			});
			post.destroy();
			res.redirect('/admin/post');
		} else if (req.params.option == 'new') {
			mode = 'new';
			resolve(true);
		} else if (req.params.option == 'edit' && req.params.id !== undefined) {
			mode = 'edit';
			resolve(await Models.post.findOne({
				where: {
					id: req.params.id
				}
			}));
		} else {
			resolve(false);
		}
	});

	res.render('admin/post.twig', { data: data, active_menu: 'post', mode: mode, data_id: data_id });
})
.post('/admin/post/:option?/:id?', Middleware.admin, Middleware.notification, Middleware.chats, async (req, res) => {
	var data = null;
	if (req.params.option == undefined || req.params.option == 'add') {
		Models.post.create({
			type: req.body.type,
			title: req.body.title,
			slug: req.body.slug,
			content: req.body.content
		}).then(console.log).catch(console.log);
	} else if (req.params.option == 'edit') {
		var post = await Models.post.findOne({
			where: {
				id: req.params.id
			}
		});

		if (post !== null) {
			post.update({
				type: req.body.type,
				title: req.body.title,
				slug: req.body.slug,
				content: req.body.content
			}).then(console.log).catch(console.log);
		}
	}

	res.json({ status: 'success'});
})

/**
 * Live Chat Module
 */
.get('/admin/live_chat/:id?', Middleware.admin, Middleware.notification, Middleware.chats, async (req, res) => {
	if (req.params.id !== undefined) {
		var chat = await Models.chat_room.findOne({
			where: {
				id: req.params.id
			},
			include: [Models.chat_participant, Models.chat_message]
		});

		if (chat !== null) {
			chat.update({
				status: 'in-progress'
			});

			var chat_participant = await Models.chat_participant.findOne({ where: { chat_room_id: chat.get('id'), user_id: req.session.user_id }});
			if (chat_participant == null) {
				await Models.chat_participant.create({ chat_room_id: chat.get('id'), user_id: req.session.user_id });
			}
		}
	}

	if (req.query.notification !== undefined) {
		var notification = await Models.notification.findOne({
			where: {
				id: req.query.notification
			}
		});

		if (notification !== null) {
			notification.update({
				status: 'opened'
			});
		}
	}

	res.render('admin/live_chat.twig', {
		active_menu: 'live_chat'
	});
})

/**
 * Chat Bot Module
 */
.get('/admin/chat_bot/:type?/:id?', Middleware.admin, Middleware.notification, Middleware.chats, async (req, res) => {
	if (req.params.type == undefined) {
		var categories = await Models.training_question.findAll({
			attributes: [ [DB.Sequelize.fn('DISTINCT', DB.Sequelize.col('category')) ,'category'] ]
		});

		res.render('admin/chat_bot.twig', {
			active_menu: 'chat_bot',
			categories: categories,
			questions: await Models.training_question.findAll(),
			answers: await Models.training_answer.findAll()
		});
	} else {
		if (req.params.type == 'question') {
			if (req.params.id !== undefined) {
				res.json({
					status: 'success',
					data: await Models.training_question.findOne({ where: { id: req.params.id } })
				});
			} else {
				res.json({
					status: 'success',
					data: await Models.training_question.findAll()
				});
			}
		} else {
			if (req.params.id !== undefined) {
				res.json({
					status: 'success',
					data: await Models.training_answer.findOne({ where: { id: req.params.id } })
				});
			} else {
				res.json({
					status: 'success',
					data: await Models.training_answer.findAll()
				});
			}
		}
	}
})
.post('/admin/chat_bot/:type/:option?/:id?', Middleware.admin, Middleware.notification, Middleware.chats, async (req, res) => {
	if (req.params.type == 'question') {
		if (req.params.option == 'add') {
			var question = await Models.training_question.create({
				category: req.body.category.trim(),
				text: req.body.text.trim()
			});

			res.json({ status: 'success', data: question });
		} else if (req.params.option == 'edit') {
			var question = await Models.training_question.findOne({ where: { id: req.params.id } });
			if (question !== null) {
				question.update({
					category: req.body.category.trim(),
					text: req.body.text.trim()
				});
			}

			res.json({ status: 'success', data: await Models.training_question.findOne({ where: { id: req.params.id } }) });
		} else {
			await Models.training_question.destroy({ where: { id: req.params.id } });
			res.json({ status: 'success' });
		}
	} else {
		if (req.params.option == 'add') {
			var answer = await Models.training_answer.create({
				category: req.body.category.trim(),
				text: req.body.text.trim()
			});

			res.json({ status: 'success', data: answer });
		} else if (req.params.option == 'edit') {
			var answer = await Models.training_answer.findOne({ where: { id: req.params.id } });
			if (answer !== null) {
				answer.update({
					category: req.body.category.trim(),
					text: req.body.text.trim()
				});
			}

			res.json({ status: 'success', data: await Models.training_answer.findOne({ where: { id: req.params.id } }) });
		} else {
			await Models.training_answer.destroy({ where: { id: req.params.id } });
			res.json({ status: 'success' });
		}
	}
})

/**
 * Sign Out
 */
.get('/admin/sign-out', Middleware.admin, (req, res) => {
	delete req.session.user_id;
	req.session.save((error) => {
		res.redirect('/admin/sign-in');
	});
});

http.listen(process.env.PORT || 8080);
