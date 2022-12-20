const passport = require('passport');
//encryption
const bcrypt = require('bcrypt');
//include the topicList model
const TopicList = require('./models/TopicList');
//include Note model
const Note = require('./models/Note');
//pug is used here to compile text returned from notes
const pug = require('pug');
//markdown parses the body of the notes
const markdown = require('markdown-it')();

module.exports = function (app, User){
  app.route('/')
    .get(ensureNotAuthenticated, function (req,res) {
      res.render("pug/index");
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
      TopicList.findOne({username:req.user.username}, function(err, data){
        if(err){
          // @polish send to error page
          console.log("ERR 1")
        }else{
          // @polish create a topic list object if none exist
          //@12/19 display the number of notes in each topic
          res.locals.topicList = data.topicList;
          res.locals.topicData = {};
          data.topicList.forEach((topic) => {
            res.locals.topicData[topic]=null;
          });

          console.log(res.locals.topicData);
          data.topicList.forEach((topic) => {
            Note.count({topic:topic},function(err,noteData){
              if(err){
                //@polish errmess
              }else if(!noteData){
                //@polish errmess
                console.log("NO DATA FOR:" + topic);
                res.locals.topicData[topic]=0;
              }else{
                console.log("THE COUNT IS " + noteData + " FOR " + topic);
                res.locals.topicData[topic]=noteData;
              }
              console.log("UPDATED: ", res.locals.topicData);
              if(Object.values(res.locals.topicData).indexOf(null) < 0){
                console.log("DONE");
                next();
              }
            });
          });
        }
      })
    }, (req, res, next) =>{
          res.render("pug/profile", {user:req.user.username,topicList:res.locals.topicList, topicData:res.locals.topicData});
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
        if(req.query.filters){
          console.log("FILTERS ACTIVE");
        }
        console.log("GETTING NOTES FOR TOPIC: " + topicName);
        //@feat filter
        Note.find({ownerName:req.user.username, topic:topicName}, function(err, data){
          if(err){
            //@polish errmess
          }else if(data.length < 1){
            console.log("NO NOTES Found");
            res.render('pug/topic',{topic:topicName});
          }else{
            let filteredData = [...data];
            if(req.query.filters){
              console.log("FILTERS ACTIVE");
              if(req.query.filterTags){
                filterTags = req.query.filterTags.split(",");
                filteredData = filteredData.filter(note => {
                  let result = true;
                  filterTags.forEach(tag => {
                    if(note.tags.indexOf(tag) < 0){
                      console.log(note.title + " is missing tag " + tag);
                      result = false;
                    }
                  });
                  return result;
                });
              }//end tag filter block
              let dateType = req.query.dateType;
              if(req.query.filterEarlyDate){
                let earlyDate = new Date(req.query.filterEarlyDate);
                console.log("EARLY DATE: " + earlyDate);
                filteredData = filteredData.filter(note =>{
                  let noteDate = note[dateType] ?
                  new Date(note[dateType]):
                  new Date(note.dateCreated);
                  console.log("NOTE DATE: " + noteDate);
                  return noteDate >= earlyDate;
                });
              }//end early date filter block
              if(req.query.filterLateDate){
                let lateDate = new Date(req.query.filterLateDate + "T00:00:00");
                console.log("LATE DATE: " + lateDate);
                filteredData = filteredData.filter(note =>{
                  let noteDate = note[dateType] ?
                    new Date(note[dateType]):
                    new Date(note.dateCreated);
                  console.log("NOTE DATE: " + noteDate);
                  return noteDate <= lateDate;
                });
              }//end late date filter
              if(req.query.filterTitle){
                filteredData = filteredData.filter(note => note.title == req.query.filterTitle);
              }//end title filter
            }//end filter block
            res.render('pug/topic',{topic:topicName,notes:filteredData});
          }
        })
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
          TopicList.findOne({username:req.user.username}, function(err,data){
            if(err){
              //@polish errmess
            }else if(!data){
              //@polish errmess
            }else{
              //default will be included in query if applicable
              console.log("PREPARING TO CREATE NOTE:", data.topicList, " FOR TOPIC : ", req.query.topic);
              res.render('pug/createNote', {defaultTopic: req.query.topic, topicList:data.topicList});
            }
          });

        });

      app.route('/note')
        .post(ensureAuthenticated, (req,res) => {
          console.log("CREATING A NEW NOTE: " + req.body.createNoteTopic);
          let tagArray = req.body.createNoteTags ?
           req.body.createNoteTags.split(","):
           [];
          //don't create two notes of same title in same topic
          Note.findOne({title:req.body.createNoteTitle, ownerName:req.user.username}, function(err,data){
            if(err){
              //@polish errmess
            }else if(data){
              //@polish errmess
              console.log("CANNOT CREATE TWO NOTES OF SAME TITLE: ", req.body.createNotetitle);
              res.redirect("/profile");
            }else{
              let myNote = new Note({
                topic: req.body.createNoteTopic,
                title: req.body.createNoteTitle,
                dateCreated:(new Date()).toLocaleDateString('en-US'),
                ownerName: req.user.username,
                content: req.body.createNoteNote,
                tags: tagArray
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
            }
          })
        });

      app.route('/notes/:noteName')
        .get(ensureAuthenticated, (req,res) => {
          let noteTitle = req.params.noteName
          console.log("DISPLAYING NOTE: " , noteTitle);
          Note.findOne({title:noteTitle, ownerName:req.user.username}, function(err, data){
            if(err || !data){
              //@polish errmess
              console.log(err);
              res.redirect("/404");
            }else{
              console.log("FOUND NOTE: ", data);
              let noteContent = markdown.render(data.content)
              res.render('pug/note',{data:data, content:noteContent})
            }
          });
        });

      app.route('/edit/:noteName')
        .get(ensureAuthenticated, (req,res) => {
          let noteTitle = req.params.noteName;
          if(!noteTitle){
            res.render('pug/edit');
          }else{
            Note.findOne({title:noteTitle, ownerName:req.user.username}, function(err,data){
              if(err){
                //@polish errmess
                console.log(err);
              }else if(!data){
                //@polish errmess
                console.log("NO NOTE FOUND");
                res.redirect('back');
              }else{
                TopicList.findOne({username:req.user.username}, function(err,topicData){
                  if(err){
                    //@polish errmess
                    console.log(err);
                  }else if(!data){
                    //@polish errmess
                    console.log("NO TL FOUND");
                    res.redirect('back');
                  }else{
                    console.log("EDITING NOTE");
                    res.render('pug/edit', {data:data, topicList:topicData.topicList});
                  }
                })

              }
            });
          }
        });

        app.route('/edit/:noteName')
          .post(ensureAuthenticated, (req,res) => {
            let noteTitle = req.params.noteName;
            let tagArray = req.body.editNoteTags ?
             req.body.editNoteTags.split(","):
             [];
            console.log("UPDATING NOTE: " + noteTitle);
            Note.findOne({title:noteTitle, ownerName: req.user.username}, function(err,data){
              if(err){
                //@polish errmess
              }else if(!data){
                //@polish errmess
                console.log("no data found");
                res.redirect('/profile');
              }else{
                data.topic = req.body.editNoteTopic;
                data.title = req.body.editNoteTitle;
                data.dateUpdated = (new Date()).toLocaleDateString('en-US');
                data.content = req.body.editNoteNote;
                data.tags = tagArray;
                data.save((err, updatedData) => {
                  if(err || !data){
                    //@polish errmess
                    console.log("ERROR UPDATING DATA");
                    res.redirect('/profile');
                  }else{
                    console.log("UPDATE SUCCESSFUL", updatedData);
                    res.redirect("/notes/" + updatedData.title);
                  }
                })
              }
            })
          });

      app.route('/editTopics')
        .get(ensureAuthenticated, (req,res) => {
          TopicList.findOne({username:req.user.username}, function(err,data){
            if(err){
              //@polish errmess
            }else if(!data){
              //@polish errmess
              console.log("no data found");
              res.redirect('/profile');
            }else{
              res.render('pug/editTopics', {data:data});
            }
          })
        });

      app.route('/delete/:dataType/:dataTitle')
        .get(ensureAuthenticated, (req,res) => {
          if(req.params.dataType == "topic"){
            res.render('pug/delete',{dataType:req.params.dataType, title:req.params.dataTitle})
          }else if(req.params.dataType == "note"){
            Note.findOne({title:req.params.dataTitle, ownerName:req.user.username},function(err,data){
              if(err){
                //@polish errmess
              }else if(!data){
                //@polish errmess
                console.log("no data found");
                res.redirect('/profile');
              }else{
                res.render('pug/delete',{dataType:req.params.dataType, data:data});
              }
            });
          }else{
            //@polish errmess
            console.log("UNKNOWN DATATYPE")
            res.redirect("/profile");
          }
        });

      app.route('/delete/:dataType/:dataTitle')
        .post(ensureAuthenticated, (req,res) => {
          console.log("DELETING..." + req.params.dataType + req.params.dataTitle);
          if(req.params.dataType == "topic"){
            TopicList.findOne({username:req.user.username}, function(err,data){
              if(err){
                //@polish errmess
              }else if(!data){
                //@polish errmess
                console.log("no topic data found");
                res.redirect('/profile');
              }else{
                data.topicList = data.topicList.filter(topic => topic !== req.params.dataTitle);
                data.save((err,updatedData) => {
                  if(err){
                    //@polish errmess
                  }else if(!updatedData){
                    //@polish errmess
                    console.log("no updata found");
                    res.redirect('/profile');
                  }else{
                    console.log("TOPIC WAS DELETED FROM LIST: " + req.params.dataTitle);
                    Note.deleteMany({topic:req.params.dataTitle, ownerName:req.user.username}, function(err,data){
                      if(err){
                        //@polish errmess
                      }else if(!data){
                        //@polish errmess
                        console.log("no data found");
                        res.redirect('/profile');
                      }else{
                        console.log("ALL NOTES DELTED UNDER TOPIC: " + req.params.dataTitle);
                        res.redirect("/profile");
                      }
                    })
                  }
                });
              }
            });
          }else if(req.params.dataType == "note"){
            Note.deleteOne({title:req.params.dataTitle, ownerName:req.user.username},function(err,data){
              if(err){
                //@polish errmess
              }else if(!data){
                //@polish errmess
                console.log("no data found");
                res.redirect('/profile');
              }else{
                //@polish, this should send you somewhere more useful
                console.log("DELETED: " + req.params.dataTitle);
                res.redirect('/profile');
              }
            })

          }else{
            //@polish errmess
            console.log("UNKNOWN DATATYPE")
            res.redirect("/profile");
          }
        });

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
