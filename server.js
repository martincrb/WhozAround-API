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

var Flickr = require("flickrapi"),
  flickrOptions = {
    api_key: flickr_key,
    secret: flickr_secret
  };

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
  console.log("Entering notifyFriends");
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
  console.log("Entering notifyUser")
  var message = new gcm.Message();
  message.addData({
    title: receiver.name+', we found a friend!',
    body: sender.name+' is also traveling to the same place as you!',
    icon: 'ic_stat_logo'
  });
  var server = new gcm.Sender(gcm_server_token);
  var regTokens = [];
  console.log(receiver);
  regTokens.push(receiver.gcmToken);
  console.log("Adding "+receiver.gcmToken);
  server.send(message, {registrationTokens: regTokens}, function(err, response) {
    if (err) {
      calls_log.log('info', "Notification to "+receiver.name+" from "+sender.name+" failed: "+err);
    }
    else {
      calls_log.log('info', "Sending notification to "+receiver.name+" from "+sender.name);
    }
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

//Create a trip for the user with id :id
router.post('/whozapi/v1/users/:id/trips', function(req, res) {
  var trip_req =req.body;
  console.log(trip_req);
  var response = {"status": "OK", "message": "Trip added succesfully"};
  calls_log.log('info', "POST@/whozapi/v1/users/"+trip_req.creator+"/trips (" + trip_req.location+" "+trip_req.date+")");
  //Parse trip data and add TRIP to database
  var trip = new Trip(
    {
        date_from:  stringToDate(trip_req.date_from, "mm/dd/yyy", "/"),
        date_until: stringToDate(trip_req.date_until, "mm/dd/yyy", "/"),
        city:       trip_req.location,
        description:  trip_req.description,
        image_url: trip_req.image_url ,
        image: trip_req.image,
        creator: trip_req.creator,
        title: trip_req.title,
        isFb: trip_req.isFb
    }
  );
  //receive url image from flickr
  Flickr.authenticate(flickrOptions, function(error, flickr) {
    flickr.photos.search({
      text: trip.city+"+image",
      tags: trip.city
    },
    function(err0, result) {
      if(err0) {
        console.log(err0);
        return;
      }
        //Build URL
        var maximum = result.photos.total;
        var minimum = 0;
        var randomnumber = Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
        var photo = result.photos.photo[randomnumber]; //First photo
        //https://farm{farm-id}.staticflickr.com/{server-id}/{id}_{secret}.jpg
        var farmid = 1;
        var url = "https://farm"+farmid+".staticflickr.com/"+photo.server+"/"+photo.id+"_"+photo.secret+".jpg";
        trip.image_url = url;
        console.log("URL: " +url);
        trip.save(function (err) {
          if (err) {
            calls_log.log('info', "Error adding trip to user "+trip_req.creator+": " + err);
            response.message = "Error adding trip to user "+trip_req.creator+": " + err;
            return console.error(err);
          }
          calls_log.log('info', "User "+trip_req.creator+" added a new TRIP from "+trip_req.date+" to "+trip_req.date2+" successfully" );
          response.message = "User "+trip_req.creator+" added the trip succesfully";
          //Notify friends with matching trips
          User.find({'fb_username' : trip_req.creator}, function (err2, docs) {
            if (err2) {
              calls_log.log('info', "MONGODB Error: " + err2);
            }
            else {
              console.log(JSON.stringify(docs[0]));
              notifyUser(docs[0].toObject(), docs[0].toObject());
            }
          });
        });
      });
    });
//Add trip to DB

  res.send(response);
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
        var conditions = {fb_username: user.fb_username}, update={$set: {gcmToken: user.gcmToken}};
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
