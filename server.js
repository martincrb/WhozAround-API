var express = require("express"),
    app = express(),
    bodyParser  = require("body-parser"),
    methodOverride = require("method-override");
    mongoose = require('mongoose'),
    winston = require('winston');

//configure logger
var calls_log = new (winston.Logger)({
    transports: [
      new (winston.transports.Console)(),
      new (winston.transports.File)({ filename: 'logs/calls_log.log' })
    ]
});

//Configure express to use bodyparser
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(methodOverride());

var router = express.Router();
mongoose.connect('mongodb://localhost/usersTest');

var tripSchema = mongoose.Schema({
  date_from: {type: Date},
  date_until: {type: Date},
  city: String,
  description: String,
  image: String,
  creator: String
});

var userSchema = mongoose.Schema({
    fb_username: String,
    hometown: String,
    gcm_token: String,
    name: String,
    surname: String,
    age: String,
    gender: String,
    email: String,
    friends: [String]
});

var User = mongoose.model('User', userSchema);
var Trip = mongoose.model('Trip', tripSchema);

function getTripsByUser(fb_user) {
  Trip.find({'creator': fb_user}, function (err, trips) {
    return trips;
  });
}

function tripsMatch(trip1, trip2) {
  var dateMatch = trip2.date_from < trip1.date_until;
  var placeMatch = trip1.city == trip2.city;
  return dateMatch && placeMatch;
}

function notifyFriends(user, newtrip) {
  var friends = user.friends;
  for (var i = 0; i < friends.length; ++i) {
      var trips = getTripsByUser(friends[i].fb_username);
      for (var j = 0; j < trips.length; ++j) {
          if (tripsMatch(newtrip, trips[j])) {
            notifyUser(originaluser, friends[i]);
          }
      }
  }
}

function notifyUser(sender, receiver) {

}
/*
var me = new User({fb_username: 'martincristobal',
                  gcm_token: '21414114',
                  name: 'Martín',
                  surname: 'Cristóbal'});
*/
//Example of saving model to mongodb
//me.save(function (err, fluffy) {
//  if (err) return console.error(err);
//});


router.get('/admin', function(req, res) {
   res.sendFile('/public/index.html' , {"root": __dirname});
});
router.get('/calls_log', function(req, res) {
   res.sendFile('/logs/calls_log.log' , {"root": __dirname});
});

//Get users
router.get('/whozapi/v1/users', function(req, res) {
  calls_log.log('call', "GET@/whozapi/v1/users (" + req + ")");
  User.find({}, function (err, docs) {
    if (err) {
      calls_log.log('result', "GET@/whozapi/v1/users (" + err + ")");
      res.send(err);
    }
    calls_log.log('result', "GET@/whozapi/v1/users (" + docs + ")");
    res.json(docs);

  });

});

//Get user with username :username
router.get('/whozapi/v1/users/:username', function(req, res) {
  User.find({'fb_username' : req.params.username}, function (err, docs) {
    if (err) {
      res.send(err);
    }
    res.json(docs);

  });
});

//Get trips of the user with username :username
router.get('/whozapi/v1/users/:username/trips', function(req, res) {
  User.find({'fb_username' : req.params.username}, function (err, docs) {
    if (err) {
      res.send(err);
    }
    res.json(docs);

  });
});

//Create a trip for the user with id :id
router.post('/whozapi/v1/users/:id/trips', function(req, res) {

});

//Get friends of the user with id :id
router.get('/whozapi/v1/users/:username/friends', function(req, res) {
  User.find({'fb_username' : req.params.username}, 'friends', function (err, docs) {
    if (err) {
      res.send(err);
    }
    res.json(docs);

  });
});

//Add friend to the user with id :id
router.post('/whozapi/v1/users/:username/friends', function(req, res) {
  //TAKE INTO ACCOUNT:
  //The friend may not exist in the users databes (what to do)
  //The friend exists: Just add username to friends array
});

//Creates a new user
app.post('/whozapi/v1/users',function(req,res){
  var user =req.body;
  console.log(user);
  calls_log.log('info', "POST@/whozapi/v1/users (" + user + ")");
  //Parse user to user model
  var user_model = new User({fb_username: user.fb_username,
                              gcm_token: user.gcm_token,
                            name: user.name,
                          surname: user.surname});
  //If new user (NOT IN DB)



  //If user already in DB:


  res.send(req.body);
});


app.use(router);

app.listen(3000, function() {
  calls_log.log('info', "Node server running on http://localhost:3000");
});
