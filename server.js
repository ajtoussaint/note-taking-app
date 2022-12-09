const express = require('express');
//for parsing req.body into json
const bodyParser = require('body-parser');

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/public', express.static(process.cwd() + '/public'));

app.route('/')
  .get(function (req,res) {
    res.sendFile(process.cwd() + '/views/index.html');
  });

app.route("/login")
  .post(function (req,res) {
    console.log("LOGIN ATTEMPT BY: ", req.body);
    res.redirect("/profile");
  });

app.route("/profile")
  .get(function (req,res) {
    res.sendFile(process.cwd() + '/views/profile.html');
  });

app.listen(3000, () =>{
  console.log("App is listening on port 3000");
});
