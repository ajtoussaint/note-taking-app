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
const MarkdownExampleText=require('./models/markdownText');

module.exports = function (app, User){
  app.route('/')
    .get(ensureNotAuthenticated, function (req,res) {
      res.render("pug/index");
    });

  app.route("/login")
    .post(passport.authenticate('local', {failureRedirect:'/'}), function (req,res) {
      //console.log("LOGIN ATTEMPT BY: ", req.body);
      res.redirect("/profile");
    });

  app.route("/profile")
    .get(ensureAuthenticated, function (req, res, next) {
      //access DB, get list of all topics associated with the user, pass into pug
      TopicList.findOne({username:req.user.username}, function(err, data){
        if(err){
          errorRedirect(err, res, "Error Finding Topic List","/profile");
        }else if(!data){
          //should never happen but create a topic list if there isn't one
          console.log("Can't find a topic list so I'm making one");
          let myTopicList = new TopicList({
            username:req.user.username,
            topicList:[]
          });

          myTopicList.save((err,data) => {
            if(err){
              errorRedirect(err, res, "Error Creating Topic List in the weird way","/");
            }else{
              console.log("CREATED TOPIC LIST: ", data);
              next();
            }
          })
        }else{
          //display the number of notes in each topic
          res.locals.topicList = data.topicList;
          res.locals.topicData = {};
          data.topicList.forEach((topic) => {
            res.locals.topicData[topic]=null;
          });
          //need this check in case the user has no topics
            if(data.topicList.length > 0){
              data.topicList.forEach((topic) => {
                //count the notes in each topic
              Note.count({topic:topic},function(err,noteData){
                if(err){
                  errorRedirect(err, res, "Error getting note count data","/profile");
                }else if(!noteData){
                  res.locals.topicData[topic]=0;
                }else{
                  res.locals.topicData[topic]=noteData;
                }
                if(Object.values(res.locals.topicData).indexOf(null) < 0){
                  next();
                }
              });
            });
          }else{
            next();
          }
        }
      })
    }, (req, res, next) =>{
          res.render("pug/profile", {user:req.user.username,topicList:res.locals.topicList, topicData:res.locals.topicData});
    });

    app.route("/register")
      .post(function (req, res, next) {
        const hash = bcrypt.hashSync(req.body.password, 9);
        User.find({username:req.body.username}, function(err, user) {
          if(err){
            next(err);
          } else if (user.length > 0){
            res.render("pug/index",{err:"username is already taken"});
          } else if (req.body.password != req.body.confirmPassword){
            res.render("pug/index",{err:"passwords must match"});
          } else{
            let myUser = new User({
              username:req.body.username,
              password:hash
            });
            myUser.save((err, data) =>{
              if(err){
                errorRedirect(err, res, "Error Saving User","/");
              }else{
                console.log("NEW USER CREATED ", data);
                //create a new TopicList object in the database for this user
                let myTopicList = new TopicList({
                  username:data.username,
                  topicList:[]
                });

                myTopicList.save((err,data) => {
                  if(err){
                    errorRedirect(err, res, "Error Creating Topic List","/");
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
        //filter
        Note.find({ownerName:req.user.username, topic:topicName}, function(err, data){
          if(err){
            errorRedirect(err, res, "Error Finding Notes","/topic/"+topicName);
          }else if(data.length < 1){
            res.render('pug/topic',{topic:topicName});
          }else{
            let filteredData = [...data];
            if(req.query.filters){
              if(req.query.filterTags){
                filterTags = req.query.filterTags.split(",");
                //trim whitespace from tags
                filterTags.forEach((tag, i) =>{
                  filterTags[i]=tag.trim();
                });
                filteredData = filteredData.filter(note => {
                  let result = true;
                  filterTags.forEach(tag => {
                    if(note.tags.indexOf(tag) < 0){
                      result = false;
                    }
                  });
                  return result;
                });
              }//end tag filter block
              let dateType = req.query.dateType;
              if(req.query.filterEarlyDate){
                let earlyDate = new Date(req.query.filterEarlyDate);
                filteredData = filteredData.filter(note =>{
                  let noteDate = note[dateType] ?
                  new Date(note[dateType]):
                  new Date(note.dateCreated);
                  return noteDate >= earlyDate;
                });
              }//end early date filter block
              if(req.query.filterLateDate){
                let lateDate = new Date(req.query.filterLateDate + "T00:00:00");
                filteredData = filteredData.filter(note =>{
                  let noteDate = note[dateType] ?
                    new Date(note[dateType]):
                    new Date(note.dateCreated);
                  return noteDate <= lateDate;
                });
              }//end late date filter
              if(req.query.filterTitle){
                filteredData = filteredData.filter(note => note.title == req.query.filterTitle);
              }//end title filter
            }//end filter block
            res.render('pug/topic',{topic:topicName,notes:filteredData,filters:req.query});
          }
        })
      });

    //use post to create a new topic
    app.route('/topic')
      .post(ensureAuthenticated, (req, res, next) => {
        //topic must not be an empty string
        if(req.body.topic.length < 1){
          errorRedirect("Error", res, "Topic name must include text","/profile");
        }else{
          //add new topic to the users topic list
          TopicList.findOne({username:req.user.username}, function(err, data){
            if(err){
              errorRedirect(err, res, "Error Finding Topic List","/profile");
            }else{
              //prevent the same topic from being made twice
              if(data.topicList.indexOf(req.body.topic) < 0){
                data.topicList.push(req.body.topic);
              }else{
                errorRedirect("Error", res, "Topic Already Exists","/profile");
              }
              data.save( (err,data) => {
                if(err){
                  errorRedirect(err, res, "Error Saving Topic List on Update","/profile");
                }else{
                  res.redirect("back");
                }
              })
            }
          })
        }
      });

      //route to create a brand new note
      app.route('/note')
        .get(ensureAuthenticated, (req, res) =>{
          //get the topics and add them to a dropdown
          TopicList.findOne({username:req.user.username}, function(err,data){
            if(err){
              errorRedirect(err, res, "Topic Already Exists","/profile");
            }else if(!data){
              errorRedirect("Error", res, "No Topic List on File","/profile");
            }else{
              //default will be included in query if applicable
              res.render('pug/createNote', {defaultTopic: req.query.topic, topicList:data.topicList});
            }
          });

        });

      app.route('/note')
        .post(ensureAuthenticated, (req,res) => {
          let tagArray = req.body.createNoteTags ?
           req.body.createNoteTags.split(","):
           [];
           //trim whitespace from tags
           tagArray.forEach((tag, i) =>{
             tagArray[i]=tag.trim();
           });
          //don't create two notes of same title in same topic
          Note.findOne({title:req.body.createNoteTitle, ownerName:req.user.username}, function(err,data){
            if(err){
              errorRedirect(err, res, "Error creating note","/topic/"+req.body.createNoteTopic);
            }else if(data){
              errorRedirect("Error", res, "CANNOT CREATE TWO NOTES OF THE SAME TITLE","/topic/"+req.body.createNoteTopic);
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
                  errorRedirect(err, res, "Error Saving Note","/topic/"+req.body.createNoteTopic);
                }else{
                  res.redirect("/topic/"+req.body.createNoteTopic);
                }
              });
            }
          })
        });

      app.route('/notes/:noteName')
        .get(ensureAuthenticated, (req,res) => {
          let noteTitle = req.params.noteName
          Note.findOne({title:noteTitle, ownerName:req.user.username}, function(err, data){
            if(err){
              errorRedirect(err, res, "Error finding note","/profile");
            }else if(!data){
              errorRedirect("Error", res, "No note on file","/profile");
            }else{
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
                errorRedirect(err, res, "Error finding note","/profile");
              }else if(!data){
                errorRedirect("Error", res, "No note on file","/profile");
              }else{
                TopicList.findOne({username:req.user.username}, function(err,topicData){
                  if(err){
                    errorRedirect(err, res, "Error finding topic list","/profile");
                  }else if(!data){
                    errorRedirect("err", res, "No topic list avialable","/profile");
                  }else{
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
            //trim whitespace from tags
            tagArray.forEach((tag, i) =>{
              tagArray[i]=tag.trim();
            });
            Note.findOne({title:noteTitle, ownerName: req.user.username}, function(err,data){
              if(err){
                errorRedirect(err, res, "Error finding note","/profile");
              }else if(!data){
                errorRedirect("Error", res, "No note on file","/profile");
              }else{
                data.topic = req.body.editNoteTopic;
                data.title = req.body.editNoteTitle;
                data.dateUpdated = (new Date()).toLocaleDateString('en-US');
                data.content = req.body.editNoteNote;
                data.tags = tagArray;
                data.save((err, updatedData) => {
                  if(err){
                    errorRedirect(err, res, "Error saving note","/profile");
                  }else{
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
              errorRedirect(err, res, "Error finding Topic List","/profile");
            }else if(!data){
              errorRedirect("err", res, "No Topic List found","/profile");
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
                errorRedirect(err, res, "Error finding note","/profile");
              }else if(!data){
                errorRedirect("Error", res, "No note on file","/profile");
              }else{
                res.render('pug/delete',{dataType:req.params.dataType, data:data});
              }
            });
          }else{
            errorRedirect("Error", res, "unknown data type","/profile");
          }
        });

      app.route('/delete/:dataType/:dataTitle')
        .post(ensureAuthenticated, (req,res) => {
          if(req.params.dataType == "topic"){
            TopicList.findOne({username:req.user.username}, function(err,data){
              if(err){
                errorRedirect(err, res, "Error finding Topic List","/profile");
              }else if(!data){
                errorRedirect("err", res, "No Topic List found","/profile");
              }else{
                data.topicList = data.topicList.filter(topic => topic !== req.params.dataTitle);
                data.save((err,updatedData) => {
                  if(err){
                    errorRedirect(err, res, "Error saving Topic List","/profile");
                  }else if(!updatedData){
                    errorRedirect("err", res, "No Topic List found","/profile");
                  }else{
                    Note.deleteMany({topic:req.params.dataTitle, ownerName:req.user.username}, function(err,data){
                      if(err){
                        errorRedirect(err, res, "Error finding note","/profile");
                      }else if(!data){
                        errorRedirect("Error", res, "No note on file","/profile");
                      }else{
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
                errorRedirect(err, res, "Error finding note","/profile");
              }else if(!data){
                errorRedirect("Error", res, "No note on file","/profile");
              }else{
                console.log("DELETED: " + req.params.dataTitle);
                res.redirect('/profile');
              }
            })

          }else{
            errorRedirect("Error", res, "unknown data type","/profile");
          }
        });

    app.route('/markdown')
      .get((req, res) => {
        let markdownText = MarkdownExampleText;
        let markdownHTML = markdown.render(markdownText);
        res.render('pug/markdown',{referrer:req.get("Referrer"),text:markdownText,content:markdownHTML});
      });

    function ensureAuthenticated(req,res,next) {
      if(req.isAuthenticated()){
        return next();
      }
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

    //easy way to show an error
    function errorRedirect(err, res, text, reroute){
      res.render('pug/errorPage', {err:err, text:text, reroute:reroute})
    }


}//end export
