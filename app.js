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

global.ViewEngine = require(__dirname+'/view-engine');
global.moment = require('moment');

app.use(
	session,
	flash(),
	express.json(),
	express.urlencoded({ extended: true })
);
app.set('views', __dirname+'/views');
app.set('view engine', 'twig');
app.use(cors({ origin : (origin, callback) => { callback(null, true) }, credentials: true }));
app.use((req, res, next) => {
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
});

http.listen(process.env.PORT || 8080);
