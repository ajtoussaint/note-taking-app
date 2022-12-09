const express = require('express');
//for parsing req.body into json
const bodyParser = require('body-parser');
//view engine for inputing variables into html
const pug = require('pug');


const app = express();

//bodyparser middleware setup
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

//pug view engine setup
app.set('view engine', 'pug');

app.use('/public', express.static(process.cwd() + '/public'));

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
