var app = angular.module("myApp", []);

app.controller("myCtrl", function($scope) {
    $scope.firstName = "John";
    $scope.lastName = "Doe";
});
/*
  $http.get('/whozapi/v1/users')
    .success(function(data) {
      $scope.users = data;
      console.log(data);
    })
    .error(function(data) {
      console.log("Error "+ data);
    });
*/
