const express = require('express');
//for parsing req.body into json
const bodyParser = require('body-parser');
//view engine for inputing variables into html
const pug = require('pug');
//express session for storing user info in cookies
const session = require('express-session');
//passport for user authentication
const passport = require('passport');
//using mongo db in conjunction with the deserializeUser function
const { ObjectID } = require('mongodb');//might not need this ?
//mongoose for db connection
const mongoose = require('mongoose');
//need this for accessing env variables
require('dotenv').config();
//imported from Modles folder for use with mongoose
const User = require('./models/User');
//import authentication code
const auth = require('./auth.js');
//import routing code
const route = require('./routes.js');

//before anything esle connect mongoose to the db
mongoose
  .connect(process.env.MONGO_URI, {useNewUrlParser: true, useUnifiedTopology: true})
  .then(
    console.log("MongoDB connected!")
    //could put all the code in here to prevent sending data before DB connects
  )
  .catch(err => console.log(err));

const app = express();

//allow things to be accessed...need to understand this better
app.use('/public', express.static(process.cwd() + '/public'));

//bodyparser middleware setup
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

//pug view engine setup
app.set('view engine', 'pug');

//set basedir for pug files to draw form
app.locals.basedir = './views/pug'

//set up sessions
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: true,
  saveUninitialized: true,
  cookie: {secure: false}
}));

//allow passport to use sessions
app.use(passport.initialize());
app.use(passport.session());

//user routes.js to apply all the routes
route(app,User);
//use the auth.js script to set up passport
auth(app,User);

//middleware that handles 404 error
app.use(function(req,res,next) {
  res.status(404)
    .render('pug/404');
});

const PORT = process.env.port || 3000;

app.listen(PORT, () =>{
  console.log("App is listening on port 3000");
});
