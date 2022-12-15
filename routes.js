const passport = require('passport');
//encryption
const bcrypt = require('bcrypt');
//include the topicList model
const TopicList = require('./models/TopicList');
//include Note model
const Note = require('./models/Note');
//pug is used here to compile text returned from notes
const pug = require('pug');

module.exports = function (app, User){
  app.route('/')
    .get(ensureNotAuthenticated, function (req,res) {
      //testing area @12/19 this is an example of how to render the pug from the note content
      let testText = "h2\n\t|Here is some text\np\n\t|some more text";
      let testTextCompiled = pug.render(testText);
      console.log(testTextCompiled);
      res.render("pug/index",{text:testTextCompiled});
    });

  app.route("/login")
    .post(passport.authenticate('local', {failureRedirect:'/'}), function (req,res) {
      console.log("LOGIN ATTEMPT BY: ", req.body);
      res.redirect("/profile");
    });

  app.route("/profile")
    .get(ensureAuthenticated, function (req, res, next) {
      console.log("IN PROFILE OF: ", req.user.username);
      //access DB, get list of all topics associated with the user, pass into pug
      TopicList.findOne({username:req.user.username}, function(err, topicList){
        // @polish create a topic list object if none exist
        if(err){
          // @polish send to error page
          console.log("ERR 1")
        }else{
          console.log(topicList);
          //better to send this as null so pug is not confused
          if(topicList.topicList.length < 1){
            res.render("pug/profile", {user:req.user.username,topicList:null});
          }else{
            res.render("pug/profile", {user:req.user.username,topicList:topicList.topicList});
          }
        }
      })
    });

    app.route("/register")
      .post(function (req, res, next) {
        console.log("ATTEMPTING TO REGISTER USER ", req.body.username, " WITH PASSWORD ", req.body.password);
        const hash = bcrypt.hashSync(req.body.password, 9);
        User.find({username:req.body.username}, function(err, user) {
          if(err){
            next(err);
          } else if (user.length > 0){
            console.log("This username is already taken", req.body.username, user);
            //@polish could redirect to home again with a pug variable to show the message
            res.redirect('/');
          } else if (req.body.password != req.body.confirmPassword){
            //@polish should add stricter password requirements
            console.log("passwords must match");
            res.redirect('/');
          } else{
            console.log("CREATING NEW USER");
            let myUser = new User({
              username:req.body.username,
              password:hash
            });
            myUser.save((err, data) =>{
              if(err){
                console.log("error in db transaction");
                res.redirect('/');
              }else{
                console.log("NEW USER CREATED ", data);
                //create a new TopicList object in the database for this user
                let myTopicList = new TopicList({
                  username:data.username,
                  topicList:[]
                });

                myTopicList.save((err,data) => {
                  if(err){
                    //@polish send to error page
                    console.log("TOPIC LIST CREATION ERROR: ",err);
                  }else{
                    console.log("CREATED TOPIC LIST: ", data);
                  }
                })
                next(null,data);
              }
            });
          }
        });
      },
        passport.authenticate('local',{failureRedirect: '/'}),
        (req, res, next) => {
          console.log("sending to new user profile");
          res.redirect('/profile');
        }
    );

    app.route('/logout')
      .get((req,res) =>{
        req.logout(function(err) {
          if(err){ return next(err); }
          res.redirect('/');
        });
      });

    app.route('/topic/:topicName')
      .get(ensureAuthenticated, (req, res, next) => {
        let topicName = req.params.topicName
        console.log("GETTING NOTES FOR TOPIC: " + topicName);

        //@12/19 implement the actual notes
        let placeHolderNotes = null;
        res.render('pug/topic',{topic:topicName,notes:placeHolderNotes})
      });

    //use post to create a new topic
    app.route('/topic')
      .post(ensureAuthenticated, (req, res, next) => {
        console.log("CREATING NEW TOPIC " + req.body.topic + " FOR " + req.user.username);
        //add new topic to the users topic list
        TopicList.findOne({username:req.user.username}, function(err, data){
          if(err){
            //@polish send to error page
            console.log("ERROR RETRIEVING TOPIC LIST TO UPDATE");
          }else{
            //@polish prevent the same topic from being made twice
            data.topicList.push(req.body.topic);
            data.save( (err,data) => {
              if(err){
                //@polish send to error page
                console.log("ERROR SAVING UPDATED TOPIC LIST");
              }else{
                console.log("return to profile")
                res.redirect("back");
              }
            })
          }
        })
      });

      //route to create a brand new note
      app.route('/note')
        .get(ensureAuthenticated, (req, res) =>{
          console.log("ENTERING NOTE TAKING PAGE");
          //@12/14 get the topics and add them to a dropdown
          //@12/14 if sent here by the topic page add a query or something that automatically uses that topic as a default
          res.render('pug/createNote');
        });

      app.route('/note')
        .post(ensureAuthenticated, (req,res) => {
          console.log("CREATING A NEW NOTE: " + req.body.createNoteTopic);
          //@12/19 need to update tags here once I have a solution for that
          //@12/19 don't create two notes of same title in same topic
          let myNote = new Note({
            topic: req.body.createNoteTopic,
            title: req.body.createNoteTitle,
            dateCreated:(new Date()).toLocaleDateString('en-US'),
            ownerName: req.user.username,
            content: req.body.createNoteNote,
            tags:[]
          });
          myNote.save((err,data) => {
            if(err){
              //@polish error message
              console.log(err);
            }else{
              console.log("CREATED NOTE: ", data);
              res.redirect('/profile');
            }
          });
        });

      app.route('/notes/:noteName')
        .get(ensureAuthenticated, (req,res) => {
          let noteTitle = req.params.noteName
          console.log("DISPLAYING NOTE: " , noteTitle);
          Note.findOne({title:noteTitle}, function(err, data){
            if(err){
              //@polish errmess
              console.log(err);
            }else{
              console.log("FOUND NOTE: ", data);
              //@12/19 find a way to get the main text of the note translated as markdown or whatever
              res.render('pug/note',{topic:data.topic, title:data.title,createdOn:data.dateCreated, content:data.content})
            }
          });
        })

    function ensureAuthenticated(req,res,next) {
      if(req.isAuthenticated()){
        return next();
      }
      console.log('Authentication invalid, go home');
      res.redirect('/');
    };

    //use this on the default route to bypass security and go to homepage
    function ensureNotAuthenticated(req, res, next) {
      if(req.isAuthenticated()){
        res.redirect('/profile');
      }else{
        return next();
      }
    }


}//end export
