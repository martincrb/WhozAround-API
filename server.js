var express = require("express"),
    app = express(),
    bodyParser  = require("body-parser"),
    methodOverride = require("method-override");
    mongoose = require('mongoose'),
    gcm = require('node-gcm'),
    winston = require('winston');

//configure logger
var gcm_server_token = 'AIzaSyCQ8jg3NTX5MzggS18dfimxV-P6TZ1hVbc';
var flickr_key = '95455618ec4f4eab692d561bbae3b516';
var flickr_secret= '211dd2af3ebe5701';

var Flickr = require("node-flickr");
var keys = {"api_key": flickr_key };

flickr = new Flickr(keys);

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
  date_from: Date,
  date_until: Date,
  city: String,
  description: String,
  image: Number,
  image_url: String,
  creator: String,
  title: String,
  isFb: Boolean
});

var userSchema = mongoose.Schema({
    fb_username: String,
    hometown: String,
    gcmToken: String,
    name: String,
    surname: String,
    age: String,
    gender: String,
    email: String,
    friends: [String]
});

var User = mongoose.model('User', userSchema);
var Trip = mongoose.model('Trip', tripSchema);

function stringToDate(_date,_format,_delimiter)
{
            var formatLowerCase=_format.toLowerCase();
            var formatItems=formatLowerCase.split(_delimiter);
            var dateItems=_date.split(_delimiter);
            var monthIndex=formatItems.indexOf("mm");
            var dayIndex=formatItems.indexOf("dd");
            var yearIndex=formatItems.indexOf("yyyy");
            var month=parseInt(dateItems[monthIndex]);
            month-=1;
            var formatedDate = new Date(dateItems[yearIndex],month,dateItems[dayIndex]);
            return formatedDate;
}

function getTripsByUser(user, fb_user, trip) {
  console.log("Checking trips of "+ fb_user);
  Trip.find({'creator': fb_user}, function (err, trips) {
    if (err) {
      calls_log.log('info', "Error retrieving trip "+err);
      return;
    }
    if (trips.length <= 0) return;
    for (var j = 0; j < trips.length; ++j) {
        console.log("for trips");
        if (tripsMatch(trip, trips[j].toObject())) {
          console.log("notify user "+fb_user);
          notifyUser(user, fb_user);
        }

    }
    console.log("out of for trips");
    return;
  });

}

function tripsMatch(trip1, trip2) {
  var dateMatch = trip1.date_from <= trip2.date_until &&
    trip1.date_until >= trip2.date_from;
  var placeMatch = trip1.city == trip2.city;
  return dateMatch && placeMatch;
}

function notifyFriends(user, newtrip) {
  console.log("Entering notifyFriends");
  var friends = user.friends;
  console.log(friends);
  for (var i = 0; i < friends.length; ++i) {
      getTripsByUser(user, friends[i], newtrip);
  }
  console.log("returning from notifyFriends");
  return;
}

function notifyUser(sender, receiver) {
  console.log("Entering notifyUser")
  User.findOne({'fb_username' : receiver}, function (err, docs) {
    if (err) {
      calls_log.log('info', "Error retrieving user");
    }
    var message = new gcm.Message();
    var user2 = docs.toObject();
    message.addData({
      title: user2.name+', we found a friend!',
      body: sender.name+' is also traveling to the same place as you!',
      icon: 'ic_stat_logo'
    });
    var server = new gcm.Sender(gcm_server_token);
    var regTokens = [];
    console.log(receiver);
    regTokens.push(user2.gcmToken);
    console.log("Adding "+user2.gcmToken);
    server.send(message, {registrationTokens: regTokens}, function(err, response) {
      if (err) {
        calls_log.log('info', "Notification to "+user2.name+" from "+sender.name+" failed: "+err);
      }
      else {
        calls_log.log('info', "Sending notification to "+user2.name+" from "+sender.name);
      }
    });

  });
}
/*
var me = new User({fb_username: 'martincristobal',
                  gcmToken: '21414114',
                  name: 'Martín',
                  surname: 'Cristóbal'});
*/
//Example of saving model to mongodb
//me.save(function (err, fluffy) {
//  if (err) return console.error(err);
//});

router.get('/', function(req, res) {
   res.sendFile('/public/webpage/index.html' , {"root": __dirname});
});

router.get('/admin', function(req, res) {
   res.sendFile('/public/index.html' , {"root": __dirname});
});

router.get('/calls_log', function(req, res) {
   res.sendFile('/logs/calls_log.log' , {"root": __dirname});
});

//Get users
router.get('/whozapi/v1/users', function(req, res) {
  calls_log.log('info', "GET@/whozapi/v1/users (" + req + ")");
  User.find({}, function (err, docs) {
    if (err) {
      calls_log.log('info', "GET@/whozapi/v1/users (" + err + ")");
      res.send(err);
    }
    calls_log.log('info', "GET@/whozapi/v1/users (" + docs + ")");
    res.json(docs);

  });

});

//Get user with username :username
router.get('/whozapi/v1/users/:username', function(req, res) {
  calls_log.log('info', "GET@/whozapi/v1/users/"+req.params.username);
  User.findOne({'fb_username' : req.params.username}, function (err, docs) {
    if (err) {
      calls_log.log('info', "Error retrieving user");
      res.send(err);
    }
    res.json(docs);

  });
});

//Get trips of the user with username :username
router.get('/whozapi/v1/users/:username/trips', function(req, res) {
  calls_log.log('info', "GET@/whozapi/v1/users/"+req.params.username+"/trips");
  Trip.find({'creator': req.params.username}, function (err, docs) {
    if (err) {
      calls_log.log('info', "Something happened retrieving the trips of "+req.params.username+" Error: "+err);
      res.send(err);
    }
    calls_log.log('info', "Retrieving trips of "+req.params.username);
    /*
    docs.forEach(function(tr) {
      console.log("Trip ------------------------------------------");
      console.log(tr.city);
      console.log(tr.date_from);
      console.log(tr.date_until);
      console.log(tr.description);
      console.log(tr.image);
      console.log(tr.image_url);
      console.log(tr.creator);
      console.log(tr.title);
      console.log(tr.isFb);
    });
    */
    res.json(docs);

  });
});

//Get trip with id ID
router.get('/whozapi/v1/trips/:id', function(req, res) {
  calls_log.log('info', "GET@/whozapi/v1/trips/"+req.params.id);
  Trip.findOne({'_id': req.params.id}, function (err, docs) {
    if (err) {
      calls_log.log('info', "Something happened retrieving the trip. Error: "+err);
      res.send(err);
    }
    calls_log.log('info', "Retrieving trip ");
    /*
    docs.forEach(function(tr) {
      console.log("Trip ------------------------------------------");
      console.log(tr.city);
      console.log(tr.date_from);
      console.log(tr.date_until);
      console.log(tr.description);
      console.log(tr.image);
      console.log(tr.image_url);
      console.log(tr.creator);
      console.log(tr.title);
      console.log(tr.isFb);
    });
    */
    res.json(docs);

  });
});

//Get friends matching user and tripid
router.get('/whozapi/v1/trips/:user/:id', function(req, res) {
  var userid = req.params.user;
  var tripid = req.params.id;
  //Get friends of user
  User.findOne({'fb_username' : req.params.user}, function (err, docs) {
    if (err) {
      //
    }
    var friends = docs.toObject().friends;
    //Once friends retrieved, get trip information
    Trip.findOne({'_id': req.params.id}, function (err, docs) {
      if (err) {
        res.send(err);
      }
      var date_from = docs.toObject().date_from;
      var date_until = docs.toObject().date_until;
      var city = docs.toObject().city;
      //Find trips created by one of my friends such that
      //trip1.date_from <= trip2.date_until &&
      //trip1.date_until >= trip2.date_from && trip1.city == trip2.city;
      Trips.find({
            $and: [
              {'creator':     {$in : friends}},
              {'date_from':   {$leq : date_until}},
              {'date_until':  {$geq : date_from}},
              {'city':        city},
            ]
            },
            'creator', //Projection (only the creator)
            function(err, docs) {
              //filter repeateds
              var unique_friends = docs.filter(function(elem, index, self) {
                return index == self.indexOf(elem);
              });
              res.send(unique_friends);
      });
    });

  });

});


//Create a trip for the user with id :id
router.post('/whozapi/v1/users/:id/trips', function(req, res) {
  var trip_req =req.body;
  console.log(trip_req);
  var response = {"status": "OK", "message": "Trip added succesfully"};
  calls_log.log('info', "POST@/whozapi/v1/users/"+trip_req.creator+"/trips (" + trip_req.city+" "+trip_req.date+")");
  //Parse trip data and add TRIP to database
  var trip = new Trip(
    {
        date_from:  trip_req.date_from,
        date_until: trip_req.date_until,
        city:       trip_req.city,
        description:  trip_req.description,
        image_url: trip_req.image_url ,
        image: trip_req.image,
        creator: trip_req.creator,
        title: trip_req.title,
        isFb: trip_req.isFb
    }
  );
  //receive url image from flickr
  var returnId = -1;
  console.log("TAGS: "+ trip.city+",city,landscape,monument,building,famous,"+trip.description.replace(" ", ","));
  flickr.get("photos.search", {"tags":trip.city+",city,landscape,building",
              "tag_mode": "all"}, function(err0, result){
   if (err0) {
     console.error(err0);
     return;
    }
    console.log(result.photos);
    //Build URL
    console.log("Building image url");
    var maximum = result.photos.total - 1;
    var minimum = 0;
    var randomnumber = Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
    var photo = result.photos.photo[0]; //First photo
    //https://farm{farm-id}.staticflickr.com/{server-id}/{id}_{secret}.jpg
    console.log(photo);
    var farmid = photo.farm;
    var url = "https://farm"+farmid+".staticflickr.com/"+photo.server+"/"+photo.id+"_"+photo.secret+".jpg";
    trip.image_url = url;
    console.log("URL: " +url);

    trip.save(function (err, t) {
      if (err) {
        calls_log.log('info', "Error adding trip to user "+trip_req.creator+": " + err);
        response.message = "Error adding trip to user "+trip_req.creator+": " + err;
        return console.error(err);
      }
      returnId = t.id;
      console.log("Trip id: " + returnId);
    //  trip._id = returnId;
      calls_log.log('info', "User "+trip_req.creator+" added a new TRIP from "+trip_req.date+" to "+trip_req.date2+" successfully" );
      response.message = "User "+trip_req.creator+" added the trip succesfully";

      //Notify friends with matching trips
      User.find({'fb_username' : trip_req.creator}, function (err2, docs) {
        if (err2) {
          calls_log.log('info', "MONGODB Error: " + err2);
        }
        else {
          console.log(JSON.stringify(docs[0]));
          notifyFriends(docs[0], trip);
          console.log("Exiting notifyFriends");
        }
      });
    });
  });
  console.log("Returning "+returnId);
  res.send(trip);
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
  var user_req =req.body;
  console.log(user_req);
  var response = {"status": "OK", "message": "User added succesfully"};
  calls_log.log('info', "POST@/whozapi/v1/users (" + user_req.facebook_username + ")");
  //Parse user to user model
  var user = new User({fb_username: user_req.facebook_username,
                          gcmToken: user_req.gcmToken,
                          name: user_req.name,
                          surname: user_req.surname,
                          hometown: user_req.hometown,
                          gender: user_req.gender,
                          age: user_req.age,
                          friends: user_req.friends,
                          email: user_req.email});
  //Check if user exists in DB: Use FIND instead of FINDONE for better perfo
  //https://blog.serverdensity.com/checking-if-a-document-exists-mongodb-slow-findone-vs-find/
  User.find({'fb_username' : user.fb_username}, function (err, docs) {
    if (err) {
      calls_log.log('info', "MONGODB Error: " + err);
    }
    else {
      if (docs.length > 0) { //User exists
        calls_log.log('info', "User "+user.fb_username+" already in the database");
        response.message = "User "+user.fb_username+" already in the database";
        //Update gcm token
        var conditions = {fb_username: user.fb_username}, update={$set: {gcmToken: user.gcmToken, friends: user.friends}};
        User.update(conditions, update, {multi: false}, function(err, numAffected) {
          if (err) {
            console.log("Error updating gcm");
          }
          else {
            console.log(numAffected+ " users affected");
          }
        });
      }
      else { //User does not exist
        user.save(function (err2) {
          if (err2) {
            calls_log.log('info', "Error adding user "+user.fb_username+": " + err2);
            response.message = "Error adding user "+user.fb_username+": " + err2;
            return console.error(err2);
          }
          calls_log.log('info', "User "+user.fb_username+" added successfully" );
          response.message = "User "+user.fb_username+" added succesfully";
        });
      }
    }

  });
  res.send(response);
});


app.use(router);

app.listen(3000, function() {
  calls_log.log('info', "Node server running on http://localhost:3000");
});
