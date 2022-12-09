const passport = require('passport');
const LocalStrategy = require('passport-local');
//encryption
const bcrypt = require('bcrypt');

module.exports = function(app, User){
  //app being the express app in server.js and User being the mongoose model

  //passport serialization and deserialization
  passport.serializeUser((user, done) => {
    done(null,user._id);
  });

  passport.deserializeUser((id, done) => {
    //Once connected to db we can deserialize into the user based on id
    User.findById(id, function(err,data) {
      if(err){
        console.log("error in deserialization ", err);
      }
      done(null,data);
    });
  });

  passport.use(new LocalStrategy(
    function(username, password, done){
      User.find({username:username}, function(err, data){
        console.log('User ' +username+' attempted to log in.');
        if(err){
          console.log(err);
          return done(err);
        }
        if (!data) {
          console.log("Found no such user");
          return done(null,false);
        }
        if (!bcrypt.compareSync(password, data[0].password)){
          console.log('wrong password');
          return done(null,false);
        }
        console.log("I'm in B)");
        return done(null,data[0]);
      });
    }
  ))

}
