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

//passport serialization and deserialization
passport.serializeUser((user, done) => {
  done(null,user._id);
});

passport.deserializeUser((id, done) => {
  //Once connected to db we can deserialize into the user based on id
  //myDataBase.findOne({_id: new ObjectID(id) }, (err,doc) =>{
  //done(null,doc);
  //delete this line after uncommenting above
  done(null,null);
  //}); //end bracket of the db call
});

app.route('/')
  .get(function (req,res) {
    //res.sendFile(process.cwd() + '/views/index.html');
    res.render("pug/index");
  });

app.route("/login")
  .post(function (req,res) {
    console.log("LOGIN ATTEMPT BY: ", req.body);
    res.render("pug/profile",{user:req.body.username});
    //res.redirect("/profile");
  });

app.route("/profile")
  .get(function (req,res) {
    console.log("IN PROF", req.body);
    res.render("pug/profile");
  });

app.listen(3000, () =>{
  console.log("App is listening on port 3000");
});
